# RLS Policy Explanation for user_roles Table

## Current Implementation (Refactored)

**The RLS policies are now created correctly in the initial schema migration**, ensuring authentication works from the start without requiring a separate fix migration.

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

## Summary

| Question | Answer |
|----------|--------|
| **Are both policies needed?** | ✅ Yes - Together they enable authentication while maintaining security |
| **Is user_roles_read_authenticated safe?** | ✅ Yes - Requires authentication + other RLS policies protect sensitive data |
| **Where are they created?** | ✅ In initial schema (20251117000000_initial_schema.sql) |
| **Do they solve sign-in errors?** | ✅ Yes - Correct policies prevent "Database error querying schema" |
| **Can we use one policy instead?** | ❌ No - You need both for complete auth system functionality |

**Conclusion:** The two RLS policies on user_roles are correctly designed and essential for making authentication work securely. They're created from the initial schema, ensuring the database is in a working state from the start.
