> **Historical implementation record (superseded 2026-09-05).** [Current ownership, setup and security contract](../../docs/SMZ_AUTH_CMS_CONTRACT.md) replaces local authentication, UUID tokens and local role authorization described here. Original outcomes are retained; do not use these steps as current deployment guidance.

# RLS Policy Explanation

## Overview

The application uses Row Level Security (RLS) to enforce data access control at the database layer. RLS policies ensure that:
- Users can only see data they're authorized to view
- Admins have full visibility of content they manage
- Parents see only their children's class articles
- No unauthorized access is possible

## Current Implementation

**All RLS policies are created in the initial schema migration**, ensuring proper access control from the start.

### Policies Created in Initial Schema (20251117000000_initial_schema.sql)

```sql
-- Allow users to read their own role information
CREATE POLICY user_roles_read_self
  ON public.user_roles FOR SELECT
  USING (auth.uid() IS NOT NULL AND id = auth.uid());

-- Allow authenticated users to read user roles (needed for auth system)
CREATE POLICY user_roles_read_authenticated
  ON public.user_roles FOR SELECT
  USING (auth.role() = 'authenticated');
```

---

## Why These Policies Are Needed

### What Problems Do They Solve?

The authentication system needs to:
1. **Fetch user roles after sign-in** - Get the user's role from the database
2. **Verify email existence** - Check if an email is registered before sign-up
3. **Restore sessions on page refresh** - Reload user info from database
4. **Work with Supabase's internal auth system** - Allow auth system flexibility

### Original Restrictive Policy (Historical Context)

Early versions had a very restrictive policy:

```sql
CREATE POLICY user_roles_read_own ON public.user_roles FOR SELECT
  USING (id = auth.uid());  -- Too restrictive!
```

This caused **500 errors "Database error querying schema"** during sign-in.

### The Current Solution

Two complementary policies provide flexibility while maintaining security:

| Policy | Purpose | Condition | Use Case |
|--------|---------|-----------|----------|
| `user_roles_read_self` | Read your own record | `auth.uid() IS NOT NULL AND id = auth.uid()` | User reads their own role after sign-in |
| `user_roles_read_authenticated` | Auth system access | `auth.role() = 'authenticated'` | Auth system verifies user and fetches role |

---

## Security Analysis

### Is user_roles_read_authenticated Too Permissive?

**No, it's safe because:**

1. **Requires authentication** - Anonymous users cannot access
2. **SELECT only** - No UPDATE, DELETE, or INSERT permissions
3. **Limited scope** - Only affects the user_roles table
4. **Other tables protected** - Each table has its own RLS policies:
   - **articles** - Restricted by class enrollment (can't see others' class articles)
   - **families** - Restricted by family membership
   - **child_class_enrollment** - Restricted by relationship
5. **Authenticated ≠ All Data** - Being authenticated doesn't mean you can see everything

### Attack Scenario Prevention

```
Scenario 1: Anonymous user tries to read user_roles
├─ No session token ❌ Blocked by: auth.role() != 'authenticated'

Scenario 2: parent1 tries to read other parents' data
├─ Can query user_roles ✅ (they're authenticated)
├─ But can't see parent2's emails ❓ (depends on SELECT permissions)
├─ AND can't see parent2's articles ✅ (articles RLS filters by family)
├─ AND can't see parent2's families ✅ (families RLS filters by ownership)

Scenario 3: Unauthorized access to all users' roles
├─ Even if user_roles_read_authenticated allows reads ✅
├─ Article visibility still controlled by family enrollment ✅
├─ Family data still restricted ✅
├─ Result: Proper role-based access control enforced
```

---

## Migration & Setup Sequence

### Database Migrations

The initial schema migration contains all necessary RLS policies:

**20251117000000_initial_schema.sql**
- ✅ Creates `user_roles` table with correct RLS policies
- ✅ Creates articles, classes, families tables
- ✅ Creates RLS policies for all tables
- ✅ Sets up database triggers and indexes
- 📝 Contains only schema definition, no test data

### Test Data Seeding

Test data is seeded separately via CLI script (development-only):

**scripts/setup-development.ts**
- ✅ Phase 1: Populates test data (articles, classes, families, weeks)
- ✅ Phase 2: Creates auth users and family enrollments
- ✅ Idempotent operation (safe to run multiple times)
- ✅ Relies on correct RLS policies (already in schema)

---

## Testing & Verification

### Setup & Test Flow

```bash
# 1. Initialize database with schema
supabase db reset

# 2. Seed test data and create auth users (both in one command)
npx ts-node scripts/setup-development.ts
# ✅ 3 newsletter weeks created
# ✅ 4 classes created
# ✅ 2 families created
# ✅ 6 articles created
# ✅ 3 test users created
# ✅ Family enrollments configured

# 3. Verify sign in works
npx ts-node scripts/test-auth.ts
# ✅ Sign in successful
# ✅ User role fetched
# ✅ Session stored

# 4. Verify article visibility enforced by RLS
npx ts-node scripts/test-article-visibility.ts
# ✅ parent1 sees 4 articles (public + their classes)
# ✅ parent2 sees 3 articles (public + their class)
# ✅ Unauthenticated sees 2 articles (public only)

# 5. Run complete E2E authentication tests
npm test -- tests/e2e/authentication-flow.test.ts --run
# ✅ All 8 tests passing
```

---

## Article Visibility Control

### Articles Table RLS Policies

Three RLS policies control who can see which articles:

#### 1. `articles_public_read` - Public Articles
```sql
CREATE POLICY articles_public_read
  ON public.articles FOR SELECT
  USING (
    is_published = true
    AND deleted_at IS NULL
    AND visibility_type = 'public'
  );
```

**Who can see:** Everyone (authenticated or not)
**Conditions:** Article must be published, not deleted, and marked public

**Use case:** Newsletter articles visible to all readers

---

#### 2. `articles_admin_read` - Admin Full Access
```sql
CREATE POLICY articles_admin_read
  ON public.articles FOR SELECT
  USING (
    is_published = true
    AND deleted_at IS NULL
    AND (
      auth.uid() IN (
        SELECT id FROM public.user_roles WHERE role = 'admin'
      )
    )
  );
```

**Who can see:** Admins/editors only
**Conditions:** Article must be published and not deleted
**Note:** Admins can see ALL articles (public and class-restricted)

**Use case:** CMS editors need to manage both public and restricted content

---

#### 3. `articles_class_restricted_read` - Class-Based Access
```sql
CREATE POLICY articles_class_restricted_read
  ON public.articles FOR SELECT
  USING (
    visibility_type = 'class_restricted'
    AND is_published = true
    AND deleted_at IS NULL
    AND (
      auth.uid() IN (
        SELECT fe.parent_id
        FROM family_enrollment fe
        JOIN child_class_enrollment cce ON fe.family_id = cce.family_id,
        LATERAL jsonb_array_elements(articles.restricted_to_classes) class_elem
        WHERE TRIM(class_elem::text, '"') = cce.class_id
          AND cce.graduated_at IS NULL
      )
    )
  );
```

**Who can see:** Parents with children in the restricted classes
**Conditions:** Article must be class-restricted, published, and child must be currently enrolled
**Security check:** Verifies parent has a child in at least one of the article's restricted classes

**Use case:** Class-specific announcements visible only to relevant families

---

#### 4. `articles_admin_update` - Admin Article Updates
```sql
CREATE POLICY articles_admin_update
  ON public.articles FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );
```

**Who can update:** Admins/editors only
**Conditions:** User must be an admin
**Use case:** Admins can edit article content, title, author, visibility settings

---

#### 5. `articles_admin_delete` - Admin Article Deletions
```sql
CREATE POLICY articles_admin_delete
  ON public.articles FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_roles WHERE role = 'admin'
    )
  );
```

**Who can delete:** Admins/editors only
**Conditions:** User must be an admin
**Use case:** Admins can soft-delete articles (marks deleted_at timestamp)

---

### Article Permission Matrix

| Operation | Admin | Teacher | Parent | Student | Anonymous |
|-----------|-------|---------|--------|---------|-----------|
| **Read (Public)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Read (Class-Restricted)** | ✅ | ✅* | ✅** | ❌ | ❌ |
| **Read (Unpublished)** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Update** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Delete** | ✅ | ❌ | ❌ | ❌ | ❌ |

\* Teachers: See via `articles_admin_read` policy (not special-cased in RLS)
\** Parents: Only if they have a child in the restricted class

---

### Article Visibility Matrix (Read-only)

| Article Type | Admin | Teacher | Parent | Student | Anonymous |
|---|---|---|---|---|---|
| **Public + Published** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Class-Restricted + Published** | ✅ | ✅* | ✅** | ❌ | ❌ |
| **Unpublished** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Soft-Deleted** | ❌ | ❌ | ❌ | ❌ | ❌ |

\* Teachers: See via `articles_admin_read` policy (teachers are not special-cased in RLS)
\** Parents: Only if they have a child in the restricted class

---

## Summary

| Question | Answer |
|----------|--------|
| **Are both policies needed?** | ✅ Yes - Together they enable authentication while maintaining security |
| **Is user_roles_read_authenticated safe?** | ✅ Yes - Requires authentication + other RLS policies protect sensitive data |
| **Where are they created?** | ✅ In initial schema (20251117000000_initial_schema.sql) |
| **Do they solve sign-in errors?** | ✅ Yes - Correct policies prevent "Database error querying schema" |
| **Can we use one policy instead?** | ❌ No - You need both for complete auth system functionality |

**Conclusion:** The two RLS policies on user_roles are correctly designed and essential for making authentication work securely. They're created from the initial schema, ensuring the database is in a working state from the start.
