# Setup Guide: CMS Database Structure

Complete setup instructions for developers implementing the Email CMS newsletter viewer application.

**Table of Contents:**
- [Prerequisites](#prerequisites)
- [Local Supabase Setup](#local-supabase-setup)
- [Development Setup](#development-setup)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- **Node.js** 18+ and npm/yarn package manager.
- **Git** for version control.
- **Docker Desktop**: The local Supabase environment runs on Docker. Make sure it is installed and running.
- **Supabase CLI**: Install it globally via npm:
  ```bash
  npm install -g supabase
  ```
- **TypeScript** knowledge (project is 100% TypeScript).
- **React 18** and **Vite 5** familiarity.

### System Requirements

- **Memory**: 8GB minimum RAM (to run Docker).
- **Disk**: 5GB free space.
- **OS**: macOS, Linux, or Windows (WSL2 recommended).
- **Node**: v18.16.0 or higher.

---

## Local Supabase Setup

### 1. Initialize Local Supabase Project

Navigate to the root of your cloned repository and run:
```bash
# Initialize supabase project
supabase init
```
This will create a `supabase` directory in your project.

### 2. Start Supabase Services

Make sure Docker Desktop is running, then start the Supabase stack:

```bash
# Start the local Supabase services
supabase start
```

On the first run, this will download the necessary Docker images. Once started, the CLI will output your local Supabase credentials, including the API URL, anon key, and database connection string.

### 3. Configure `.env.local` File

Create a `.env.local` file in the project root. Copy the credentials from the `supabase start` output:

```bash
# Copy example env
cp .env.example .env.local
```

Edit `.env.local` with the local credentials. It should look something like this:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Development settings
VITE_API_TIMEOUT=5000
VITE_ENABLE_LOGGING=true
```

### 4. Database Migrations

The database schema is defined in `supabase/migrations/20251117000000_initial_schema.sql`. The Supabase CLI automatically applies any new migrations in the `supabase/migrations` directory when you run `supabase start`.

If you need to reset your local database and re-apply all migrations, you can run:
```bash
supabase db reset
```

### 5. Seed Database (Optional)

Load sample data for development:

```bash
# Run seeding script
npx ts-node scripts/seed-database.ts
```

**Note**: The seeding script uses the credentials from your `.env.local` file to connect to the local Supabase instance.

---

## Development Setup

### 1. Install Dependencies

```bash
# Install all project dependencies
npm install
```

### 2. Start Development Server

```bash
# Start Vite dev server with HMR
npm run dev

# Opens at http://localhost:5173
# Hot Module Reload enabled - changes reflect instantly
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
supabase start          # Start local Supabase
supabase stop           # Stop local Supabase
supabase db reset       # Reset local database
npx ts-node scripts/seed-database.ts    # Seed sample data
npx ts-node scripts/health-check.ts     # Verify database
```

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

You can connect to your local database using any PostgreSQL client with the connection string provided by `supabase start`, or you can use the Supabase Studio, which is typically available at `http://127.0.0.1:54323`.

In the Studio, navigate to the **Table Editor** and verify that all tables from the schema exist.

You can also run the health check script:
```bash
# Run health check script
npx ts-node scripts/health-check.ts
```

### 3. Run Tests

Run the test suite to ensure everything is working correctly with the local database.
```bash
# Run all tests
npm test -- --run
```

---

## Troubleshooting

### "Cannot find module '@supabase/supabase-js'"

```bash
# Solution: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### "Environment variable VITE_SUPABASE_URL is not defined"

```bash
# Solution: Check .env.local file exists and has correct values from 'supabase start'
cat .env.local
```

### "Database connection failed" or "Cannot reach Supabase"

- Verify that the Docker containers are running (`docker ps`).
- Ensure the `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` match the output from `supabase start`.
- Check that no other service is using ports `54321` or `54323`.
- Run `supabase status` to check the health of the local services.

### "Tables do not exist"

- Ensure the migration file `supabase/migrations/20251117000000_initial_schema.sql` exists.
- Run `supabase db reset` to wipe the local database and re-apply all migrations.

### "Port 5173 already in use"

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
