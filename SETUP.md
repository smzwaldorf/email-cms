# Setup Guide: CMS Database Structure

Complete setup instructions for developers implementing the Email CMS newsletter viewer application.

**Table of Contents:**
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Database Initialization](#database-initialization)
- [Development Setup](#development-setup)
- [Test Database Setup](#test-database-setup)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- **Node.js** 18+ and npm/yarn package manager
- **Git** for version control
- **Supabase Account** (free tier available at https://supabase.com)
- **TypeScript** knowledge (project is 100% TypeScript)
- **React 18** and **Vite 5** familiarity

### System Requirements

- **Memory**: 4GB minimum RAM
- **Disk**: 2GB free space
- **OS**: macOS, Linux, or Windows (WSL2 recommended)
- **Node**: v18.16.0 or higher

---

## Environment Setup

### 1. Clone Repository

```bash
# Clone the repository
git clone https://github.com/YOUR_ORG/email-cms.git
cd email-cms

# Switch to appropriate branch
git checkout 002-database-structure
```

### 2. Install Dependencies

```bash
# Install all project dependencies
npm install

# Verify installation
npm --version  # Should be v8+
node --version # Should be v18+
```

### 3. Create `.env.local` File

Create a `.env.local` file in the project root with your Supabase credentials:

```bash
# Copy example env
cp .env.example .env.local

# Edit with your credentials
cat > .env.local << 'EOF'
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# Development settings
VITE_API_TIMEOUT=5000
VITE_ENABLE_LOGGING=true
EOF
```

### Getting Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create new project or select existing one
3. Navigate to **Project Settings** → **API**
4. Copy:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`

**⚠️ Security Note**: Never commit `.env.local` to Git. It's in `.gitignore` by default.

---

## Database Initialization

### 1. Create Supabase Project

1. Log in to [Supabase Dashboard](https://app.supabase.com)
2. Click **New Project**
3. Choose:
   - **Name**: `email-cms` (or your preference)
   - **Database Password**: Generate strong password (save this!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is sufficient for development

### 2. Run Database Schema

Once project is created:

1. Go to **SQL Editor**
2. Click **New Query**
3. Open `specs/002-database-structure/contracts/schema.sql`
4. Copy entire contents
5. Paste into SQL Editor
6. Click **Run**

Expected output:
```
8 tables created
10 indexes created
3 triggers created
RLS policies enabled
```

### 3. Verify Tables Created

In **Table Editor**, verify all tables exist:

- ✓ `newsletter_weeks`
- ✓ `articles`
- ✓ `classes`
- ✓ `user_roles`
- ✓ `families`
- ✓ `family_enrollment`
- ✓ `child_class_enrollment`
- ✓ `teacher_class_assignment`
- ✓ `article_audit_log`

### 4. Enable Row-Level Security (RLS)

For production, RLS should be enabled:

1. Go to **Authentication** → **Policies**
2. Ensure policies are created per specification
3. Test with sample queries to verify access control

For development/testing with anon key:
```sql
-- Temporarily disable RLS for development (NOT FOR PRODUCTION)
ALTER TABLE articles DISABLE ROW LEVEL SECURITY;
ALTER TABLE families DISABLE ROW LEVEL SECURITY;
```

### 5. Seed Database (Optional)

Load sample data for development:

```bash
# Run seeding script
npx ts-node scripts/seed-database.ts

# This creates:
# - 10 sample newsletter weeks (2025-W40 to 2025-W49)
# - 4 sample classes (A1, A2, B1, B2 with grades 1-2)
# - 20 sample articles across weeks
```

**Note**: Seeding is optional. You can manually create data via Supabase UI.

---

## Development Setup

### 1. Start Development Server

```bash
# Start Vite dev server with HMR
npm run dev

# Opens at http://localhost:5173
# Hot Module Reload enabled - changes reflect instantly
```

### 2. Project Structure Overview

```
email-cms/
├── src/
│   ├── components/          # React components
│   ├── pages/              # Page-level components
│   ├── services/           # Business logic (ArticleService, etc.)
│   ├── repositories/       # Data access layer
│   ├── queries/            # SQL-like query builders
│   ├── hooks/              # Custom React hooks
│   ├── context/            # React Context for state
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Helper utilities
│   ├── lib/                # External library wrappers (Supabase)
│   └── styles/             # Global CSS/Tailwind
├── tests/
│   ├── unit/               # Unit tests
│   ├── components/         # Component tests
│   ├── integration/        # E2E workflow tests
│   ├── performance/        # Performance benchmarks
│   └── services/           # Service layer tests
├── scripts/
│   ├── seed-database.ts    # Database seeding
│   └── health-check.ts     # Health verification
├── specs/                  # Specification documents
├── .env.local             # Local environment (don't commit!)
├── .env.example           # Example environment
├── vite.config.ts         # Vite configuration
├── tsconfig.json          # TypeScript configuration
├── tailwind.config.ts     # Tailwind CSS theming
└── vitest.config.ts       # Test framework config
```

### 3. Key Development Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Production build
npm run preview         # Preview production build
npm run lint            # ESLint check
npm run format          # Prettier format

# Testing
npm test                # Run tests in watch mode
npm test -- --run       # Run tests once (CI mode)
npm test -- --ui        # Visual test interface
npm run coverage        # Coverage report

# Database
npx ts-node scripts/seed-database.ts    # Seed sample data
npx ts-node scripts/health-check.ts     # Verify database
```

---

## Test Database Setup

### 1. Create Test Database

Create a separate Supabase project for testing:

```bash
# Create .env.test file
cat > .env.test << 'EOF'
VITE_SUPABASE_TEST_URL=https://your-test-project.supabase.co
VITE_SUPABASE_TEST_KEY=eyJhbGciOiJIUzI1NiIs...
VITE_TEST_MODE=true
EOF
```

### 2. Run Schema on Test Database

Repeat the same steps as [Database Initialization](#database-initialization) but for your test project:

1. Create test project in Supabase
2. Run `schema.sql` on test database
3. Verify all tables created

### 3. Run Tests

```bash
# Run all tests
npm test -- --run

# Run specific test file
npm test -- ArticleService.test.ts

# Run tests matching pattern
npm test -- -t "should create article"

# Run with coverage
npm run coverage
```

**Note**: Tests use mocked Supabase client, so test database is optional. Tests include proper mocking.

---

## Verification

### 1. Verify Installation

```bash
# Check Node and npm
node --version    # v18+
npm --version     # v8+

# Check dependencies
npm ls supabase   # Should be v2.x
npm ls react      # Should be v18+
npm ls vite       # Should be v5+
```

### 2. Test Database Connection

```bash
# Run health check script
npx ts-node scripts/health-check.ts

# Expected output:
# ✓ Database Connection
# ✓ Database Tables (9 tables)
# ✓ Database Triggers
# ✓ Database Constraints
# ⚠ Database Indexes (warning is OK)
# Status: WARNING (or HEALTHY)
```

### 3. Run Smoke Tests

```bash
# Run a few key tests to verify setup
npm test -- ArticleService.test.ts --run

# Should output:
# ✓ ArticleService Tests (15+ tests)
# Test Files: 1 passed
# Tests: 15+ passed
```

### 4. Start Development Server

```bash
# Start the dev server
npm run dev

# Verify in browser:
# 1. Open http://localhost:5173
# 2. Check console for errors
# 3. Navigate around the application
# 4. Try creating/editing an article

# Should load without errors
```

---

## Troubleshooting

### Common Issues

#### "Cannot find module '@supabase/supabase-js'"

```bash
# Solution: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### "Environment variable VITE_SUPABASE_URL is not defined"

```bash
# Solution: Check .env.local file exists and has correct values
cat .env.local

# Should show:
# VITE_SUPABASE_URL=https://...
# VITE_SUPABASE_ANON_KEY=eyJ...
```

#### "Database connection failed"

```bash
# Solution 1: Verify Supabase project is active
# Go to Supabase Dashboard → Project Settings → Status

# Solution 2: Check credentials are correct
cat .env.local
# Compare with Supabase Dashboard → Settings → API

# Solution 3: Verify network connectivity
curl -I "https://your-project.supabase.co/rest/v1/articles?limit=1"
# Should return 200 or 401 (not connection refused)
```

#### "Tables do not exist"

```bash
# Solution: Run schema.sql again
# 1. Go to Supabase Dashboard
# 2. SQL Editor → New Query
# 3. Copy/paste contents of specs/002-database-structure/contracts/schema.sql
# 4. Click Run

# Verify:
npm ts-node scripts/health-check.ts
```

#### "Tests failing with 'RLS policy violation'"

```bash
# Solution: Tests mock Supabase, but if using real DB:
# Disable RLS temporarily for development:
# In Supabase → Authentication → Policies
# Toggle "Enable RLS" off for tables

# Re-enable for production!
```

#### "Port 5173 already in use"

```bash
# Solution: Kill process using port
# macOS/Linux:
lsof -ti:5173 | xargs kill -9

# Windows:
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Or use different port:
npm run dev -- --port 5174
```

#### "TypeScript compilation errors"

```bash
# Solution: Rebuild TypeScript
npm run build

# Or check types:
npx tsc --noEmit

# If issues persist, ensure tsconfig.json has:
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true
  }
}
```

### Getting Help

If issues persist:

1. **Check documentation**:
   - [TESTING.md](./TESTING.md) - Testing setup
   - [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment
   - [specs/002-database-structure/](./specs/002-database-structure/) - Feature spec

2. **Review logs**:
   ```bash
   # Check browser console (F12)
   # Check terminal output for errors
   # Enable debug logging:
   VITE_ENABLE_LOGGING=true npm run dev
   ```

3. **Verify database state**:
   ```bash
   # Run health check
   npx ts-node scripts/health-check.ts

   # Check health report
   cat health-check-report.json | jq .
   ```

---

## Next Steps

After successful setup:

1. **Read the specification**: Review [specs/002-database-structure/spec.md](./specs/002-database-structure/spec.md)
2. **Understand the architecture**: See [specs/002-database-structure/plan.md](./specs/002-database-structure/plan.md)
3. **Explore the codebase**: Start with `src/services/ArticleService.ts`
4. **Run tests**: `npm test` to see working examples
5. **Start developing**: Create/edit articles via the app or API

---

## Support

For issues or questions:

- **GitHub Issues**: [Report a bug](https://github.com/anthropics/claude-code/issues)
- **Documentation**: See [README.md](./README.md)
- **Tests as examples**: See `tests/` directory for usage patterns

---

**Last Updated**: 2025-11-17
**Phase**: 7 - Polish & Cross-Cutting Concerns
**Status**: Complete
