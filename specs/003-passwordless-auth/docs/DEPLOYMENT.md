# Production Deployment Guide (T089)

**Phase**: 11 - Documentation & Delivery
**Updated**: 2025-11-29
**Branch**: `003-passwordless-auth`

---

## Deployment Overview

This guide covers deploying the passwordless authentication system to production using:
- **Platform**: Zeabur (for hosting)
- **Database**: Supabase (managed PostgreSQL)
- **Authentication**: Supabase Auth
- **Email**: SendGrid (via Supabase)

---

## Pre-Deployment Checklist

Before deploying to production, verify:

- [ ] All tests passing locally: `npm test -- --run`
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors: `npm run build`
- [ ] Environment variables documented
- [ ] Supabase production project created
- [ ] OAuth credentials for production configured
- [ ] Domain name ready
- [ ] SSL certificate planned
- [ ] Database backups configured
- [ ] Monitoring plan prepared

---

## Prerequisites

### Required Accounts
- **Zeabur account** (https://zeabur.com)
- **Supabase account** (https://supabase.com)
- **Google OAuth credentials** (production app)
- **GitHub account** (for CI/CD)
- **SendGrid account** (optional, for email)

### Required Tools
- `git` command line
- Terminal/command prompt
- GitHub access

---

## Step 1: Create Production Supabase Project

### 1.1 Create New Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose region closest to your users
4. Set secure database password
5. Wait for project initialization (5-10 minutes)

### 1.2 Get Production Credentials

1. Go to **Settings** → **API** in left sidebar
2. Copy:
   - **Project URL**: `https://xxxxxxxxxxxx.supabase.co`
   - **Anon Key**: `eyJhbGc...`
   - **Service Role Key**: `eyJhbGc...` (keep secret!)

### 1.3 Configure OAuth

**Google OAuth:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. In OAuth consent screen:
   - Set app name
   - Add your domain
   - Add authorized domains
3. Create OAuth credentials:
   - Application type: Web application
   - Authorized redirect URIs:
     ```
     https://yourdomain.com/auth/callback
     https://xxxxxxxxxxxx.supabase.co/auth/v1/callback
     ```
4. Copy Client ID and Secret
5. In Supabase dashboard:
   - **Authentication** → **Providers** → **Google**
   - Paste credentials
   - Enable provider

### 1.4 Run Database Migrations

The migrations should auto-apply. To verify manually:

```sql
-- In Supabase SQL Editor, check tables exist:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected tables:
-- auth_events
-- user_roles
-- sessions
-- magic_link_tokens
-- rate_limit_attempts
```

### 1.5 Configure RLS Policies

Verify Row-Level Security policies:

1. Go to **Authentication** → **Policies**
2. Check policies are enabled for:
   - `auth_events`
   - `user_roles`
   - `sessions`

---

## Step 2: Prepare Application for Production

### 2.1 Update Environment Variables

Create `.env.production`:

```env
# Supabase
VITE_SUPABASE_URL=https://your-production-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key

# Application
VITE_APP_URL=https://yourdomain.com

# Optional
VITE_DEBUG=false
VITE_LOG_LEVEL=error
```

### 2.2 Build for Production

```bash
# Install dependencies
npm install

# Build
npm run build

# Verify build
ls -la dist/

# Test production build locally
npm run preview
```

### 2.3 Security Checks

```bash
# Check for console.log statements (remove debug code)
grep -r "console.log" src/ --exclude-dir=node_modules

# Check for hardcoded secrets
grep -r "SUPABASE_" src/ --exclude-dir=node_modules

# Run security audit
npm audit

# Check for vulnerabilities
npm audit --audit-level=moderate
```

---

## Step 3: Deploy to Zeabur

### 3.1 Connect GitHub Repository

1. Go to [zeabur.com](https://zeabur.com)
2. Sign in / Create account
3. Click "New Project"
4. Select "Deploy your source code"
5. Connect GitHub account
6. Select your repository
7. Select branch: `003-passwordless-auth` or `main`

### 3.2 Configure Build Settings

In Zeabur project settings:

```
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

### 3.3 Set Environment Variables

In Zeabur project:

1. Go to **Settings** → **Environment Variables**
2. Add variables from `.env.production`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_APP_URL=https://yourdomain.com
   VITE_DEBUG=false
   ```

### 3.4 Configure Domain

In Zeabur:

1. Go to **Domains**
2. Add custom domain: `yourdomain.com`
3. Update DNS records:
   ```
   CNAME yourdomain.com → zeabur-provided-domain
   ```
4. Wait for DNS propagation (up to 48 hours)
5. Verify SSL certificate auto-enables

### 3.5 Deploy

1. Click "Deploy"
2. Wait for build (5-15 minutes)
3. Check deployment logs for errors
4. Once complete, your app is live!

---

## Step 4: Post-Deployment Verification

### 4.1 Health Check

```bash
# Test HTTPS
curl https://yourdomain.com

# Verify API connectivity
curl -H "Authorization: Bearer test" \
  https://yourdomain.com

# Check home page loads
open https://yourdomain.com
```

### 4.2 Test Authentication Flows

1. **Google OAuth**:
   - Click "Login with Google"
   - Verify redirect to Google
   - Verify redirect back to app
   - Verify successful login

2. **Magic Link**:
   - Enter email
   - Check email (check spam folder)
   - Click link
   - Verify auto-login

3. **Session Persistence**:
   - Login
   - Refresh page (F5)
   - Verify still logged in
   - Close browser
   - Reopen app
   - Verify session restored

### 4.3 Database Connectivity

In Supabase dashboard:

```sql
-- Check auth_events table
SELECT COUNT(*) FROM auth_events;

-- Check user_roles
SELECT COUNT(*) FROM user_roles;

-- Check latest login event
SELECT * FROM auth_events
ORDER BY created_at DESC
LIMIT 1;
```

---

## Step 5: Monitoring & Maintenance

### 5.1 Enable Logging

In Supabase:

1. Go to **Logs** section
2. Monitor:
   - Auth errors
   - Database queries
   - API latency
   - Failed requests

### 5.2 Set Up Alerting

Create alerts for:
- Failed deployments
- High error rate (>5% of requests)
- High latency (>5 seconds)
- Database connection errors
- Rate limit exceeded

### 5.3 Monitor Performance

Track metrics:
- Page load time: Target <3 seconds
- Login time: Target <10 seconds
- API response time: Target <500ms

### 5.4 Database Backups

In Supabase:

1. Go to **Backups**
2. Enable automatic backups
3. Set retention: 30 days
4. Test restore procedure monthly

### 5.5 Scaling Configuration

For handling increased load:

**Database Scaling:**
```
Monitor: Connection count, Query performance
Action: Upgrade to Pro plan if needed
```

**Application Scaling:**
```
Monitor: CPU usage, Memory usage
Action: Zeabur auto-scales based on traffic
```

---

## Step 6: Security Configuration

### 6.1 HTTPS/SSL

Zeabur auto-configures SSL with Let's Encrypt:
- [ ] Verify HTTPS works: `https://yourdomain.com`
- [ ] Check certificate validity
- [ ] Auto-renewal configured

### 6.2 CORS Configuration

Update CORS in Supabase:

1. Go to **Authentication** → **CORS**
2. Add production domain:
   ```
   https://yourdomain.com
   ```

### 6.3 Rate Limiting

Verify rate limiting in production:

- Magic Link: 5 per hour per email ✅
- Password: Managed by Supabase ✅
- API: Monitor 429 responses

### 6.4 Secrets Management

Never commit secrets:
- [ ] `.env.local` in `.gitignore`
- [ ] `VITE_SUPABASE_ANON_KEY` only in Zeabur secrets
- [ ] Service keys never in client code
- [ ] Use environment variables for all secrets

---

## Step 7: Continuous Deployment

### 7.1 GitHub Integration

Zeabur automatically deploys on push:

```bash
# Push to trigger deployment
git push origin main

# Zeabur builds and deploys automatically
# Deployment typically takes 5-15 minutes
```

### 7.2 Rollback Procedure

If deployment fails:

1. **Check Zeabur Logs**:
   - Go to Zeabur project
   - View deployment logs
   - Check for build errors

2. **Rollback to Previous**:
   - In Zeabur: **Deployments** → previous version
   - Click "Redeploy"
   - Verify rollback successful

3. **Fix & Redeploy**:
   ```bash
   # Fix the issue locally
   git fix-issue
   npm test -- --run
   npm run build

   # Push to trigger new deployment
   git push origin main
   ```

---

## Troubleshooting

### Deployment Fails

**Check logs:**
```bash
# In Zeabur, view full build logs
# Look for:
# - npm install errors
# - Build errors
# - Environment variable issues
```

**Common issues:**
- Missing environment variables
- npm install failure → check package.json
- Build failure → verify `npm run build` works locally

### Application Crashes

**Debug steps:**
1. Check Zeabur logs for errors
2. Check Supabase connection
3. Verify environment variables
4. Check browser console for errors
5. Verify API endpoints are correct

**Fix:**
```bash
# Ensure local tests pass first
npm test -- --run

# Then redeploy
git push origin main
```

### Database Connection Issues

**Verify:**
1. Supabase project is running
2. Environment variables are correct
3. Network connectivity
4. RLS policies aren't blocking access

**Test connection:**
```bash
# In browser console
const { data, error } = await supabase.auth.getSession();
console.log(data, error);
```

### OAuth Not Working

**Check:**
1. Redirect URI in Google Console matches: `https://yourdomain.com/auth/callback`
2. OAuth credentials in Supabase match Google Console
3. Google OAuth is enabled in Supabase
4. Domain is HTTPS

**Fix:**
1. Update Google Console redirect URIs
2. Wait 5 minutes for propagation
3. Test again

---

## Performance Optimization

### 7.1 CDN Configuration

Zeabur includes CDN. To optimize:

1. Ensure all static assets are in `dist/`
2. Enable aggressive caching for:
   - JavaScript bundles
   - CSS files
   - Images
3. Monitor cache hit ratio

### 7.2 Database Query Optimization

Monitor slow queries:

```sql
-- In Supabase, check slow queries
-- Typical auth queries should be <100ms
-- If slower, check indexes are created
```

### 7.3 Bundle Size Reduction

Check production bundle:

```bash
npm run build
# Check dist/ folder size
# Target: main bundle < 500KB gzipped
```

---

## Maintenance Schedule

### Daily
- Monitor error logs
- Check authentication metrics
- Verify uptime

### Weekly
- Review performance metrics
- Check for failed deployments
- Verify backups completed

### Monthly
- Test database recovery
- Audit access logs
- Review security events
- Update dependencies

### Quarterly
- Full security audit
- Load testing
- Disaster recovery drill
- Update external dependencies

---

## Rollback Checklist

In case of critical issues:

- [ ] Revert to previous Zeabur deployment
- [ ] Verify authentication still works
- [ ] Check error logs for issues
- [ ] Fix the issue
- [ ] Test locally thoroughly
- [ ] Redeploy to production
- [ ] Verify fix works
- [ ] Document incident

---

## Support & Resources

- **Zeabur Docs**: https://zeabur.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **GitHub Actions**: https://docs.github.com/en/actions
- **SSL/TLS**: https://letsencrypt.org/

---

## Deployment Checklist

Before going live:

- [ ] All tests pass locally
- [ ] Production build succeeds
- [ ] Environment variables configured
- [ ] Supabase production project created
- [ ] OAuth configured for production domain
- [ ] Database migrations applied
- [ ] RLS policies verified
- [ ] Zeabur project connected
- [ ] Domain configured with DNS
- [ ] HTTPS working
- [ ] Health checks passing
- [ ] Authentication flows tested
- [ ] Monitoring configured
- [ ] Backups enabled
- [ ] Team notified

---

**Deployment Guide Complete** ✅

Your application is now ready for production use!
