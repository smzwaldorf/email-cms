# Local Development Setup Guide (T087)

**Phase**: 11 - Documentation & Delivery
**Updated**: 2025-11-29
**Branch**: `003-passwordless-auth`

---

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software
- **Node.js** 18.x or higher ([download](https://nodejs.org/))
- **npm** 9.x or higher (comes with Node.js)
- **Git** ([download](https://git-scm.com/))
- **A text editor** (VS Code recommended)

### Required Accounts
- **GitHub account** (for cloning the repository)
- **Supabase account** (free tier available at [supabase.com](https://supabase.com))
- **Google OAuth credentials** (for Google login testing)

### System Requirements
- 2GB RAM minimum
- 500MB free disk space
- Internet connection for Supabase and OAuth

---

## Step 1: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/yourusername/email-cms.git
cd email-cms

# Checkout the passwordless-auth branch
git checkout 003-passwordless-auth

# Verify you're on the correct branch
git branch -v
```

---

## Step 2: Install Dependencies

```bash
# Install all npm packages
npm install

# Verify installation
npm list --depth=0

# Expected output should show:
# - react 18.x
# - typescript 5.x
# - vite 5.x
# - vitest (for testing)
```

**Installation time**: ~2-3 minutes depending on internet speed

---

## Step 3: Environment Configuration

### Create `.env.local` File

```bash
# Copy the example file
cp .env.local.example .env.local

# Open in your editor and fill in the values
# Supported editors:
# - VS Code: code .env.local
# - nano: nano .env.local
# - vim: vim .env.local
```

### Get Your Supabase Credentials

1. Go to [supabase.com](https://supabase.com) and sign in
2. Create a new project (or use existing)
3. Go to **Settings** → **API** in the left sidebar
4. Copy the following values:

```env
# From Supabase API Settings page:
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Optional: For admin operations (not needed for local dev)
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Google+ API"
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URI:
   ```
   http://localhost:5173/auth/callback
   ```
6. Copy Client ID and Client Secret
7. In Supabase dashboard, go to **Authentication** → **Providers** → **Google**
8. Paste the credentials and enable

### Complete `.env.local`

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Application
VITE_APP_URL=http://localhost:5173

# Optional: API logging
VITE_DEBUG=false
```

---

## Step 4: Supabase Setup

### Create Supabase Tables

The database migrations are automatically applied. To verify:

```bash
# In Supabase dashboard, go to SQL Editor
# The following tables should exist:
# - auth.users (Supabase built-in)
# - public.auth_events
# - public.user_roles
# - public.sessions
# - public.magic_link_tokens
# - public.rate_limit_attempts

# To manually check, run in SQL Editor:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

### Enable RLS Policies

1. Go to Supabase dashboard → **Authentication** → **Policies**
2. Verify these policies are enabled:
   - auth_events: Users can view own events
   - user_roles: Role-based access
   - sessions: User session isolation

### Configure Magic Link

1. In Supabase, go to **Authentication** → **Email Templates**
2. Keep default magic link template (already configured)
3. Test email functionality (optional):
   ```bash
   # Magic links will be logged but not actually sent in local development
   # Check auth_events table to verify logging works
   ```

### Configure Google OAuth

1. In Supabase, go to **Authentication** → **Providers** → **Google**
2. Enable the provider
3. Paste your Google OAuth credentials
4. Save

---

## Step 5: Run the Application

### Start Development Server

```bash
# Start the development server with hot reload
npm run dev

# Expected output:
#   ➜  Local:   http://localhost:5173/
#   ➜  press h + enter to show help

# Open in your browser
open http://localhost:5173
# Or manually navigate to: http://localhost:5173
```

**Development server features:**
- Hot Module Replacement (HMR) - changes apply instantly
- Port 5173 (or next available if in use)
- Automatic browser refresh on file changes

### Test the Application

#### Google OAuth Login
1. Click "Login with Google" button
2. You'll be redirected to Google
3. Select an account or sign in
4. Authorize the application
5. You'll be redirected back to the dashboard

#### Magic Link Login
1. Click "Login with Magic Link" button
2. Enter any email address
3. In development, the magic link URL will be logged to console
4. Copy the link and open it in browser
5. You'll be automatically signed in

#### Test Navigation
- Navigate between different articles
- Use keyboard shortcuts:
  - `→` or `n` or `j`: Next article
  - `←` or `p` or `k`: Previous article
  - `e`: Edit current article

---

## Step 6: Running Tests

### Run All Tests

```bash
# Run tests in watch mode (default)
npm test

# Run tests once and exit
npm test -- --run

# Run specific test file
npm test -- SessionManagement.test.ts

# Run tests matching pattern
npm test -- -t "should sign in"
```

### Test Coverage Report

```bash
# Generate coverage report
npm run coverage

# View HTML coverage report
open coverage/index.html
```

### Expected Test Results

```
✅ Test Files: 48 passed | 1 skipped (49 total)
✅ Test Cases: 828 passed (0 failures)
✅ Coverage: >80% for authentication modules
✅ Duration: ~7-8 seconds
```

---

## Step 7: Build & Production Preview

### Build for Production

```bash
# Build the application
npm run build

# Check for build errors
# Output: dist/ folder with compiled files
```

### Preview Production Build

```bash
# Start production preview server
npm run preview

# Opens http://localhost:4173
# Tests the production build locally
```

---

## Step 8: Code Quality Checks

### TypeScript Check

```bash
# Check for TypeScript errors
npm run type-check

# Or just run build (includes type check)
npm run build
```

### ESLint Check

```bash
# Check code quality
npm run lint

# Automatically fix issues
npm run lint -- --fix
```

### Format Code

```bash
# Format code with Prettier
npm run format
```

---

## Troubleshooting

### Issue: "Module not found" errors

**Solution:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: Supabase connection fails

**Check:**
1. `.env.local` file exists and has correct values
2. Supabase project is running (check supabase.com)
3. Network connection is working
4. VITE_SUPABASE_URL format is correct (should start with `https://`)

**Fix:**
```bash
# Verify env vars are loaded
npm run dev
# Check browser console for connection errors
```

### Issue: Google OAuth not working

**Check:**
1. Redirect URI in Google Console matches `http://localhost:5173/auth/callback`
2. OAuth credentials are pasted in Supabase Google provider settings
3. Google OAuth is enabled in Supabase
4. You're testing with correct Google account

**Test:**
```bash
# Open browser console (F12) and look for auth errors
# Check Network tab to see OAuth redirect happening
```

### Issue: Tests failing with timeout

**Solution:**
```bash
# Increase test timeout
npm test -- --run --reporter=verbose

# Or run specific slow tests
npm test -- --run SessionManagement.test.ts
```

### Issue: Port 5173 already in use

**Solution:**
```bash
# Vite will automatically use next available port
# Check console output for actual port
# Or manually specify port:
npm run dev -- --port 5174
```

### Issue: "Cannot find module '@'" errors

**Explanation:** Path alias is configured in `vite.config.ts`
**Check:**
```typescript
// vite.config.ts should have:
resolve: {
  alias: {
    '@': '/src'
  }
}
```

**Fix:** This should already be configured. If not, rebuild:
```bash
npm run dev
```

---

## Common Tasks

### Add a New Feature

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes
# Test changes
npm test -- --run

# Commit
git add .
git commit -m "feat: Add my feature"
```

### Debug Authentication Issues

```bash
# Enable debug logging in .env.local
VITE_DEBUG=true

# In browser console, look for 🔐 and 🔄 prefixed logs
# Check Network tab for API requests
# Check Application → Storage for session tokens
```

### Check Audit Logs

```bash
# In Supabase dashboard, go to SQL Editor
SELECT * FROM auth_events
ORDER BY created_at DESC
LIMIT 20;
```

### View Active Sessions

```bash
# In Supabase dashboard, go to SQL Editor
SELECT * FROM sessions
WHERE user_id = '<your-user-id>'
ORDER BY created_at DESC;
```

---

## Environment Variables Reference

| Variable | Description | Required | Example |
|----------|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | Yes | `eyJhbGc...` |
| `VITE_APP_URL` | Application URL | No | `http://localhost:5173` |
| `VITE_DEBUG` | Enable debug logging | No | `true` or `false` |

---

## Getting Help

### Common Resources

- **Supabase Docs**: https://supabase.com/docs
- **React Docs**: https://react.dev
- **Vite Docs**: https://vitejs.dev
- **TypeScript Docs**: https://www.typescriptlang.org/docs/

### Debug Commands

```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Check Git status
git status

# View environment variables (secure - only shows names)
env | grep VITE

# Test API connection
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://xxxxxxxxxxxx.supabase.co/auth/v1/user
```

### Verify Setup

```bash
# Run this script to verify all prerequisites
npm run dev 2>&1 | grep -E "Local:|error|Error"

# If no errors appear, setup is complete!
```

---

## Next Steps

After setup is complete:

1. **Read the Architecture** → Review `specs/003-passwordless-auth/PHASE-10-VERIFICATION.md`
2. **Explore the Code** → Start in `src/` directory
3. **Run Tests** → `npm test` to see current test suite
4. **Try Features** → Test Google OAuth and Magic Link login
5. **Read API Docs** → See `API-ENDPOINTS.md` for available endpoints

---

## Setup Verification Checklist

Before you're ready to develop, verify:

- [ ] Node.js 18+ installed: `node --version`
- [ ] npm 9+ installed: `npm --version`
- [ ] Repository cloned: `git branch` shows `003-passwordless-auth`
- [ ] Dependencies installed: `npm list --depth=0` shows all packages
- [ ] `.env.local` file created with Supabase keys
- [ ] Google OAuth configured in Supabase
- [ ] `npm run dev` starts without errors
- [ ] Tests pass: `npm test -- --run`
- [ ] Can login with Google OAuth
- [ ] Can login with Magic Link
- [ ] Console shows no 🔴 errors

**Once all checks pass, you're ready to develop!** ✅

---

## Support

If you encounter issues:

1. Check **Troubleshooting** section above
2. Review error messages carefully
3. Check browser console (F12)
4. Review Supabase logs in dashboard
5. Ask for help in project discussions

---

**Setup Guide Complete** ✅
Next: Begin Phase 11 documentation tasks!
