# Supabase Project Setup Guide

This guide walks through setting up a Supabase project for the Email CMS Newsletter Viewer application.

## Prerequisites

- Supabase account (free tier at https://app.supabase.com)
- Node.js 18+ and npm
- This repository cloned locally

## Step 1: Create or Select a Supabase Project

### Option A: Create a New Project
1. Go to https://app.supabase.com
2. Click "New project"
3. Fill in project details:
   - **Name**: Email CMS (or your preference)
   - **Database Password**: Create a strong password
   - **Region**: Select closest to your location
4. Click "Create new project" (wait 2-3 minutes for setup)

### Option B: Use Existing Project
1. Go to https://app.supabase.com
2. Select your project from the list

## Step 2: Initialize Database Schema

The database schema is defined in: `specs/002-database-structure/contracts/schema.sql`

### Method A: Supabase Dashboard (Recommended)

1. In Supabase Dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy the entire contents of `specs/002-database-structure/contracts/schema.sql`
4. Paste into the SQL Editor
5. Click "Run" (or Cmd+Enter)
6. Verify: Navigate to **Table Editor** and confirm all 9 tables exist:
   - newsletter_weeks
   - articles
   - classes
   - user_roles
   - families
   - family_enrollment
   - child_class_enrollment
   - teacher_class_assignment
   - article_audit_log

### Method B: CLI (for staging/production)

If you have `supabase-cli` installed:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

## Step 3: Get API Credentials

1. Go to Supabase Dashboard > **Settings** > **API**
2. Copy the following values:
   - **Project URL**: Under "Project URL"
   - **anon key**: Under "Project API keys" > "anon" public

## Step 4: Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in the credentials from Step 3:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. Keep other variables as-is (with defaults)

## Step 5: Verify Database Connection

Run the verification script:

```bash
npx ts-node scripts/verify-schema.ts
```

Expected output:
```
✅ Schema verification PASSED
✅ All required tables are present
✅ All required indexes are configured

✨ Your Supabase database is ready for use!
```

## Step 6: Seed Sample Data (Optional)

To populate the database with sample articles for testing:

### Option A: Use Supabase Dashboard SQL Editor

1. Go to Supabase Dashboard > **SQL Editor**
2. Create a new query with sample insert statements
3. See `scripts/seed-database.ts` for example data structure

### Option B: Temporarily Disable RLS (Development Only)

If you want to use the seeding script:

1. In Supabase Dashboard, go to **Authentication** > **Policies**
2. For each table, click the disable RLS button
3. Run: `npx ts-node scripts/seed-database.ts`
4. Re-enable RLS after seeding

### Option C: Use Service Role Key (Recommended)

For better security, use the service role key in the seeding script:

1. Go to Supabase Dashboard > **Settings** > **API**
2. Copy the `service_role` key (keep this private!)
3. Update `scripts/seed-database.ts` to use this key
4. Run: `npx ts-node scripts/seed-database.ts`

## Step 7: Start Development Server

```bash
npm run dev
```

Navigate to http://localhost:5173 and you should see the newsletter viewer with your data.

## Troubleshooting

### Connection Error: "Cannot reach Supabase"

- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`
- Check that your Supabase project is active (Settings > General)
- Ensure internet connection and firewall allows connections to Supabase

### Tables Not Found

- Verify schema.sql was executed successfully
- Check Supabase Dashboard > **Table Editor** to see existing tables
- If tables are missing, re-run the schema.sql script

### Row-Level Security (RLS) Errors

- **When reading**: This is expected for restricted articles (check RLS policies)
- **When seeding**: Disable RLS temporarily or use service role key (see Step 6)
- **In production**: Keep RLS enabled for security

### Authentication Errors

- Check that you're using the `anon` key (not `service_role`)
- Verify the key hasn't been rotated in Supabase Dashboard
- Clear browser cache and restart dev server

## Configuration Reference

### Environment Variables

| Variable | Required | Example | Purpose |
|----------|----------|---------|---------|
| `VITE_SUPABASE_URL` | Yes | `https://xyz.supabase.co` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | `eyJhbGc...` | Public API key for client-side |
| `VITE_APP_URL` | No | `http://localhost:5173` | Application URL |
| `VITE_APP_NAME` | No | `電子報 CMS` | Display name |
| `VITE_SUPABASE_TEST_URL` | No | Same as above | Test database URL |
| `VITE_SUPABASE_TEST_KEY` | No | Same as above | Test database key |

### Database Schema Summary

See `specs/002-database-structure/ERD.md` for complete Entity-Relationship diagram.

**Core Tables**:
- `newsletter_weeks`: Weekly newsletter containers
- `articles`: Individual article content

**Access Control**:
- `classes`: School classes
- `user_roles`: User authentication and roles
- `families`: Parent grouping
- `family_enrollment`: Parent-family relationships
- `child_class_enrollment`: Child-class relationships
- `teacher_class_assignment`: Teacher-class assignments

**Audit Trail**:
- `article_audit_log`: Change tracking

### Performance Targets

- Article retrieval: <500ms (100 articles)
- Class filtering: <100ms
- Article switching: <1000ms

See `specs/002-database-structure/quickstart.md` for query examples and performance benchmarks.

## Next Steps

1. **Run the application**: `npm run dev`
2. **Read the quickstart guide**: `specs/002-database-structure/quickstart.md`
3. **Review the data model**: `specs/002-database-structure/data-model.md`
4. **Start development**: Begin implementing features from `specs/002-database-structure/tasks.md`

## Security Considerations

### For Development
- ✅ RLS can be disabled temporarily for easier local development
- ✅ It's safe to use sample credentials in `.env.local` (not committed)
- ✅ Use separate Supabase project for testing if possible

### For Production
- 🔒 **Always enable RLS** on all tables
- 🔒 **Never commit** `.env.local` or `SUPABASE_SERVICE_ROLE_KEY`
- 🔒 Use **environment secrets** in CI/CD and hosting platforms
- 🔒 Rotate API keys regularly
- 🔒 Review RLS policies for each table
- 🔒 Enable database backups
- 🔒 Monitor audit logs for unusual activity

## Support

For issues with Supabase:
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase GitHub Discussions](https://github.com/supabase/supabase/discussions)
- [Supabase Support](https://supabase.com/support)

For issues with this project:
- Check the project [TESTING.md](./TESTING.md) for test setup
- Review [specs/002-database-structure/](./specs/002-database-structure/) for feature documentation
