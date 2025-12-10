import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { analyticsAggregator } from '@/services/analyticsAggregator';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Supabase Admin Client for Seeding
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase Environment Variables');
}

const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Helper to seed a test user with a specific role
 */
async function seedTestUser(email: string, role: string) {
    // 1. Create Auth User
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
        email,
        password: 'password123',
        email_confirm: true
    });

    if (authError || !authData.user) {
        throw new Error(`Failed to create user ${email}: ${authError?.message}`);
    }

    const userId = authData.user.id;

    // 2. Assign Role
    const { error: roleError } = await adminSupabase.from('user_roles').insert({
        id: userId,
        email,
        role
    });

    if (roleError) throw new Error(`Failed to assign role: ${roleError.message}`);

    return { user: authData.user };
}

describe('Analytics - Article Reader Class Info', () => {
    // Constraint requires YYYY-WXX (2 digits). We only have 100 slots.
    // To identify this test run, we'll try to pick a random one but also clean it up.
    const randomSuffix = Math.floor(Math.random() * 90) + 10;
    const weekNum = `2099-W${randomSuffix}`;
    const testId = Date.now().toString(); // Still keep this for other unique names
    // Use consistent pattern for easier cleanup
    const mockEmail = `test-analytics-parent-${testId}@test.com`;
    const mockAdminEmail = `test-analytics-admin-${testId}@test.com`;
    const mockClassName = `C-${randomSuffix}-${Math.floor(Math.random()*1000)}`; // Max: C-99-999 = 8 chars
    const mockStudentName = `Student-${testId}`;
    
    // Tracking for cleanup
    let testEmails: string[] = [];
    let testUserIds: string[] = [];

    // State variables
    let parentUserId: string;
    let adminUserId: string;
    let familyId: string;
    let studentId: string;
    let articleId: string;

    beforeEach(async () => {
        // Reset tracking
        testEmails = [];
        testUserIds = [];

        // 1. Create Parent User
        const { user: parent } = await seedTestUser(mockEmail, 'parent');
        parentUserId = parent.id;
        testEmails.push(mockEmail);
        testUserIds.push(parentUserId);

        // 2. Create Admin User
        const { user: admin } = await seedTestUser(mockAdminEmail, 'admin');
        adminUserId = admin.id;
        testEmails.push(mockAdminEmail);
        testUserIds.push(adminUserId);

        // 3. Create Class
        await adminSupabase.from('classes').insert({
            id: mockClassName,
            class_name: mockClassName,
            class_grade_year: 1
        });

        // 4. Create Family
        const { data: family } = await adminSupabase.from('families').insert({
            family_code: `F-${testId}`
        }).select().single();
        
        if (!family) throw new Error('Family creation failed');
        familyId = family.id;

        // 5. Enroll Parent
        await adminSupabase.from('family_enrollment').insert({
            family_id: familyId,
            parent_id: parentUserId,
            relationship: 'father'
        });

        // 6. Create Student
        const { data: student } = await adminSupabase.from('students').insert({
            name: mockStudentName
        }).select().single();
        
        if (!student) throw new Error('Student creation failed');
        studentId = student.id;

        // 7. Enroll Student in Family
        await adminSupabase.from('family_enrollment').insert({
            family_id: familyId,
            student_id: student.id,
            relationship: 'child'
        });

        // 8. Enroll Student in Class
        const { error: enrollError } = await adminSupabase.from('student_class_enrollment').insert({
            student_id: student.id,
            family_id: familyId,
            class_id: mockClassName
        });

        if (enrollError) {
             throw new Error(`Enrollment failed: ${enrollError.message} (details: ${enrollError.details})`);
        }

        // 9. Article Setup
        
        // Clean events first (fk)
        await adminSupabase.from('analytics_events').delete().eq('newsletter_id', weekNum);
        
        // Clean snapshots too (potential FK blocker)
        await adminSupabase.from('analytics_snapshots').delete().eq('newsletter_id', weekNum);

        // Ensure week exists (Newsletter Weeks)
        const { error: weekError } = await adminSupabase.from('newsletter_weeks').upsert({
            week_number: weekNum,
            release_date: '2099-01-01',
            is_published: true
        }, { onConflict: 'week_number' });
        
        if (weekError) throw weekError;

        // Create Article (Upsert to avoid unique constraint violation)
        const { data: article, error: articleError } = await adminSupabase.from('articles').upsert({
            week_number: weekNum,
            title: 'Test Analytics Article',
            content: 'Content',
            article_order: 1, 
            is_published: true,
            visibility_type: 'public'
        }, { onConflict: 'week_number, article_order' }).select().single();

        if (!article) {
             console.error('Article creation error:', articleError);
             throw new Error('Article creation failed: ' + articleError?.message);
        }
        articleId = article.id;

        // 10. Log View
        await adminSupabase.from('analytics_events').insert({
            article_id: articleId,
            newsletter_id: weekNum,
            user_id: parentUserId,
            event_type: 'page_view',
            metadata: { ua: 'test-agent' }
        });
    });

    afterEach(async () => {
        try {
            // Clean up in dependency order (reverse of creation)

            // 1. Delete analytics events (references article)
            if (articleId) {
                const { error } = await adminSupabase.from('analytics_events').delete().eq('article_id', articleId);
                if (error) console.error('Failed to delete analytics_events:', error);
            }

            // 2. Delete analytics snapshots
            const { error: snapError } = await adminSupabase.from('analytics_snapshots').delete().eq('newsletter_id', weekNum);
            if (snapError) console.error('Failed to delete analytics_snapshots:', snapError);

            // 3. Delete articles (and normally audit logs cascade, but we want to ensure we don't block)
            if (articleId) {
                // Now that we fixed the DB schema (removed FK on audit log), 
                // deleting the article should succeed and trigger the audit log insertion without error.
                const { error: delError } = await adminSupabase
                    .from('articles')
                    .delete()
                    .eq('id', articleId);
                
                if (delError) {
                    console.error('Failed to delete article:', delError);
                }

                // Double check audit logs are gone or kept (depending on requirements, but often for tests we want clean slate)
                // Since we removed FK, cascade might not delete them anymore? 
                // Wait, if we removed the FK, we lost the CASCADE DELETE too! 
                // So we MUST manually delete audit logs now if we want them gone.
                const { error: auditDelError } = await adminSupabase
                    .from('article_audit_log')
                    .delete()
                    .eq('article_id', articleId);
                
                if (auditDelError) {
                    console.error('Failed to delete article_audit_log:', auditDelError);
                }
            }

            // 4. Delete student class enrollments
            if (studentId) {
                const { error } = await adminSupabase.from('student_class_enrollment').delete().eq('student_id', studentId);
                if (error) console.error('Failed to delete student_class_enrollment:', error);
            }

            // 5. Delete family enrollments
            if (familyId) {
                const { error } = await adminSupabase.from('family_enrollment').delete().eq('family_id', familyId);
                if (error) console.error('Failed to delete family_enrollment:', error);
            }

            // 6. Delete students
            if (studentId) {
                const { error } = await adminSupabase.from('students').delete().eq('id', studentId);
                if (error) console.error('Failed to delete students:', error);
            }

            // 7. Delete families
            if (familyId) {
                const { error } = await adminSupabase.from('families').delete().eq('id', familyId);
                if (error) console.error('Failed to delete families:', error);
            }

            // 8. Delete newsletter weeks
            await adminSupabase.from('newsletter_weeks').delete().eq('week_number', weekNum);

            // 9. Delete classes
            const { error: classError } = await adminSupabase.from('classes').delete().eq('id', mockClassName);
            if (classError) console.error('Failed to delete classes:', classError);

            // 10. Robust User Cleanup
            // First cleanup known auth events
            if (testUserIds.length > 0) {
                for (const userId of testUserIds) {
                    // Delete auth_events for known user IDs
                    await adminSupabase
                        .from('auth_events')
                        .delete()
                        .eq('user_id', userId);
                    
                    // Also delete user_roles using ID
                    await adminSupabase
                        .from('user_roles')
                        .delete()
                        .eq('id', userId);
                }
            }
            
            if (testEmails.length > 0) {
                 for (const email of testEmails) {
                    // Delete auth_events using email metadata fallback
                    await adminSupabase
                        .from('auth_events')
                        .delete()
                        .ilike('metadata->email', email);
                 }
            }
            
            // Safety sweep: find any leftover users matching our pattern
            const { data: { users }, error: listError } = await adminSupabase.auth.admin.listUsers({ perPage: 1000 });
            
            if (!listError && users) {
                const usersToDelete = users.filter(u => u.email?.startsWith('test-analytics-'));
                
                if (usersToDelete.length > 0) {
                    console.log(`Cleaning up ${usersToDelete.length} 'test-analytics-' users...`);
                    for (const user of usersToDelete) {
                        try {
                            // Ensure roles are gone
                            await adminSupabase.from('user_roles').delete().eq('id', user.id);
                            // Ensure auth events are gone
                            await adminSupabase.from('auth_events').delete().eq('user_id', user.id);
                            // Delete user
                            await adminSupabase.auth.admin.deleteUser(user.id);
                        } catch (delErr) {
                            console.error(`Failed to delete user ${user.id}:`, delErr);
                        }
                    }
                }
            }

        } catch (err) {
            console.error('Error during afterEach cleanup:', err);
        }
    });

    it('should include class name and student name in reader list', async () => {
        // Authenticate the shared client for analyticsAggregator
        const { getSupabaseClient } = await import('@/lib/supabase');
        const client = getSupabaseClient();
        
        await client.auth.signOut(); // Ensure clean state
        
        const { error } = await client.auth.signInWithPassword({
            email: mockAdminEmail,
            password: 'password123'
        });
        
        if (error) throw new Error(`Admin sign-in failed: ${error.message}`);

        // VERIFY DATA EXISTENCE DIRECTLY
        const { data: directEnrollment } = await adminSupabase.from('student_class_enrollment').select('*').eq('family_id', familyId);
        
        if (!directEnrollment || directEnrollment.length === 0) {
            throw new Error('TEST SETUP FAILURE: student_class_enrollment not inserted or not visible to admin');
        }

        // ACT
        const readers = await analyticsAggregator.getArticleReaders(articleId);
        
        // ASSERT
        const parentReader = readers.find(r => r.userId === parentUserId);
        
        expect(parentReader).toBeDefined();
        // This confirms the JOIN worked despite RLS
        expect(parentReader?.className).toContain(mockClassName);
        expect(parentReader?.studentNames).toContain(mockStudentName);
    });
});
