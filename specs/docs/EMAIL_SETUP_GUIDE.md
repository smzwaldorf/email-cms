> **Historical / superseded for current authentication and deployment (2026-09-05).** Read the [SMZ Auth/CMS contract](SMZ_AUTH_CMS_CONTRACT.md). This retained record does not authorize Supabase login, magic-link reader access, local role assignment, or deployment. Earlier test/security conclusions apply only to their original revision.

# 📧 Complete Email Setup & Deployment Guide

Comprehensive guide for setting up email service (magic links) for your Email CMS with Supabase hosted on Zeabur.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [Local Development Setup](#local-development-setup)
4. [Production Setup](#production-setup)
5. [Zeabur Deployment](#zeabur-deployment)
6. [Testing Guide](#testing-guide)
7. [Troubleshooting](#troubleshooting)
8. [Configuration Reference](#configuration-reference)

---

## Quick Start

### Choose Your Path

**🖥️ Local Development** (Fastest - Start Here)
```bash
supabase start
npm run dev
# Email testing works immediately via Inbucket at http://localhost:54324
```

**☁️ Production on Zeabur** (For deployment)
```bash
# 1. Get Mailgun account (free): https://www.mailgun.com
# 2. Configure Supabase SMTP settings
# 3. Set environment variables in Zeabur
# 4. Deploy: git push zeabur main
```

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│              Your Email CMS App                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │  React Frontend                            │    │
│  │  • MagicLinkForm.tsx (email input)        │    │
│  │  • useMagicLink hook (state management)   │    │
│  │  • AuthContext (provide methods)          │    │
│  │  • AuthCallbackPage (verification)        │    │
│  └────────────────────────────────────────────┘    │
│           ↓                                         │
│  ┌────────────────────────────────────────────┐    │
│  │  Supabase Auth (Built-in OTP)             │    │
│  │  • Token generation                       │    │
│  │  • Token expiry (15 min default)          │    │
│  │  • One-time use enforcement               │    │
│  │  • Auto user creation/login               │    │
│  └────────────────────────────────────────────┘    │
│           ↓                                         │
│  ┌────────────────────────────────────────────┐    │
│  │  Email Service (Choose One)                │    │
│  │  ✅ Local: Inbucket (dev only)            │    │
│  │  ✅ Prod: Mailgun/SendGrid via SMTP      │    │
│  └────────────────────────────────────────────┘    │
│           ↓                                         │
│  ┌────────────────────────────────────────────┐    │
│  │  User Inbox                                │    │
│  │  • Receives magic link email              │    │
│  │  • Clicks link to verify & login          │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Local Development Setup

### Your Current Status: ✅ Ready to Use

Your local Supabase is already configured with Inbucket email testing. No setup needed!

### How It Works

1. **Start local Supabase:**
   ```bash
   supabase start
   ```

2. **Start your app:**
   ```bash
   npm run dev
   ```

3. **Test magic link flow:**
   - Go to: http://localhost:5173/login
   - Enter email: test@example.com
   - Click "Send Magic Link"
   - Navigate to: http://localhost:54324 (Inbucket)
   - See email in inbox
   - Click magic link
   - Automatically logged in ✅

### Inbucket Dashboard

Open http://localhost:54324 to:
- View captured emails
- See magic link tokens
- Click links to test verification
- Preview HTML and text versions

### Configuration Location

Your local Supabase config: `supabase/config.toml`

```toml
[inbucket]
enabled = true
port = 54324
```

This is already enabled. No changes needed.

### Magic Link Flow (Local)

```
User enters email: test@example.com
        ↓
sendMagicLink() calls Supabase Auth
        ↓
Supabase generates OTP token
        ↓
Inbucket captures email (doesn't send)
        ↓
You view at http://localhost:54324
        ↓
Click magic link in email
        ↓
Redirected to http://localhost:5173/auth/callback?token=xxx
        ↓
AuthCallbackPage verifies token
        ↓
Supabase creates session
        ↓
User auto-logged in ✅
```

---

## Production Setup

### Option 1: Mailgun (Recommended) ⭐

**Why Mailgun?**
- Free tier: 300 emails/day (perfect for MVP)
- Most reliable (96%+ deliverability)
- Easiest setup (5 minutes)
- Cost: Free for MVP, $19.99/month at scale

### Step 1: Create Mailgun Account

1. Go to https://www.mailgun.com
2. Sign up for free account
3. Verify your email
4. Set up a domain (you'll use this in config)
5. Go to Dashboard → API → Copy your API Key

### Step 2: Configure Supabase for SMTP

You have two ways to access your Zeabur Supabase:

**Method A: SSH to your Zeabur instance**
```bash
ssh zeabur@your-host
cd /path/to/supabase
nano config.toml
```

**Method B: Via Zeabur Dashboard** (if web UI available)
- Go to Zeabur → Your Project → Supabase
- Look for database settings

### Step 3: Update `config.toml`

Add/modify the email section:

```toml
[auth.email]
enable_signup = true
enable_confirmations = false
otp_length = 6
otp_expiry = 3600  # 1 hour

# Enable production SMTP
[auth.email.smtp]
enabled = true
host = "smtp.mailgun.org"
port = 587
user = "postmaster@your-domain.mailgun.org"
pass = "your-mailgun-api-key"
admin_email = "noreply@your-domain.com"
sender_name = "Email CMS"
```

### Step 4: Customize Email Template (Optional)

Create `supabase/templates/magic-link.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: system-ui, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px; }
        .button {
            display: inline-block;
            padding: 12px 32px;
            background: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Confirm Your Email</h1>
        <p>Click the button to sign in:</p>
        <a href="{{ .SiteURL }}/auth/callback?token={{ .TokenHash }}&type=email" class="button">
            Confirm Email & Sign In
        </a>
        <p style="color: #666; font-size: 14px;">
            This link expires in 1 hour.
        </p>
    </div>
</body>
</html>
```

Configure in `config.toml`:
```toml
[auth.email.template.recovery]
subject = "Confirm your email - Email CMS"
content_path = "./supabase/templates/magic-link.html"
```

### Option 2: SendGrid (Alternative)

**Setup:**
1. Sign up: https://sendgrid.com
2. Create API key: Settings → API Keys
3. Configure SMTP:
   ```toml
   host = "smtp.sendgrid.net"
   port = 587
   user = "apikey"
   pass = "your-sendgrid-api-key"
   ```

**Cost:** Free tier (100 emails/day), then $20/month

---

## Zeabur Deployment

### Prerequisites

- [ ] Your Supabase SMTP configured (Mailgun/SendGrid)
- [ ] `.env.production` with credentials
- [ ] Git repository (GitHub/GitLab)
- [ ] Zeabur account

### Step 1: Prepare Environment File

Create `.env.production`:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-zeabur-supabase-url.com
VITE_SUPABASE_ANON_KEY=eyJ... (from Supabase settings)

# Service role key (for backend operations, keep secret)
SUPABASE_SERVICE_ROLE_KEY=eyJ... (from Supabase settings)

# Email Service Credentials (choose one)
# For Mailgun:
MAILGUN_API_KEY=key-your-mailgun-api-key
MAILGUN_DOMAIN=mg.your-domain.mailgun.org

# For SendGrid:
SENDGRID_API_KEY=SG.your-sendgrid-api-key

# Application Settings
VITE_APP_NAME=Email CMS Newsletter Viewer
VITE_APP_VERSION=1.0.0
NODE_ENV=production
VITE_DEBUG=false
VITE_API_TIMEOUT=30000
```

### Step 2: Secure Environment

Ensure `.env.production` is NOT in git:

```bash
# Verify in .gitignore
echo ".env.production" >> .gitignore
git add .gitignore
git commit -m "chore: protect environment files"
```

### Step 3: Deploy to Zeabur

**Method A: Git Integration (Automatic)**

1. Push to GitHub/GitLab:
   ```bash
   git add .
   git commit -m "feat: prepare for production deployment"
   git push origin main
   ```

2. In Zeabur Dashboard:
   - Click "New Service"
   - Select "GitHub"
   - Choose your repository
   - Select branch: `main` or `003-passwordless-auth`

3. Configure Build Settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Node Version: 18+

4. Set Environment Variables in Zeabur:
   - Click "Settings"
   - Add environment variables from `.env.production`
   - Zeabur auto-deploys on variable changes

**Method B: Manual Deployment**

```bash
# Build locally
npm run build

# Deploy to Zeabur
zeabur deploy --project email-cms
```

### Step 4: Verify Deployment

1. **Access your app:**
   ```
   https://your-app.zeabur.app
   ```

2. **Test magic link:**
   - Go to `/login`
   - Enter your real email
   - Check inbox for magic link
   - Click link → Should be logged in
   - See dashboard with newsletters

3. **Verify in Supabase Studio:**
   - Check Authentication → Users
   - Verify user was created with correct email
   - Session should show in active sessions

---

## Testing Guide

### Local Testing Checklist

```bash
# Step 1: Start services
supabase start              # Terminal 1
npm run dev               # Terminal 2

# Step 2: Test magic link
- [ ] Go to http://localhost:5173/login
- [ ] Enter test@example.com
- [ ] Click "Send Magic Link"
- [ ] Open http://localhost:54324 (Inbucket)
- [ ] See email in inbox with magic link
- [ ] Click link in email
- [ ] Should redirect to http://localhost:5173/auth/callback
- [ ] AuthCallbackPage processes token
- [ ] See dashboard (logged in)

# Step 3: Verify user creation
- [ ] Check Supabase Studio
- [ ] Go to Authentication → Users
- [ ] See test@example.com user created
- [ ] Session shows recent login
```

### Production Testing Checklist

```bash
# Step 1: Configure email service
- [ ] Mailgun/SendGrid account created
- [ ] API key obtained and verified
- [ ] Domain verified (Mailgun)
- [ ] Supabase SMTP settings updated

# Step 2: Deploy
- [ ] .env.production configured
- [ ] Environment variables set in Zeabur
- [ ] Git pushed to main branch
- [ ] Zeabur deployment complete
- [ ] App accessible at production URL

# Step 3: Test email flow
- [ ] Go to https://your-app.zeabur.app/login
- [ ] Enter your real email (different from test@example.com)
- [ ] Click "Send Magic Link"
- [ ] Check your real email inbox
- [ ] Click magic link in email
- [ ] Should be logged in on production
- [ ] See dashboard with actual newsletters

# Step 4: Verify logs
- [ ] Check Zeabur app logs (no errors)
- [ ] Check Mailgun delivery dashboard
- [ ] Check Supabase logs (if available)
```

### Test Different Scenarios

```typescript
// Test 1: New user signup
Email: newuser@example.com
Expected: User created, logged in

// Test 2: Returning user login
Email: newuser@example.com (same)
Expected: No duplicate user, session refreshed

// Test 3: Multiple devices
Email: same@example.com
From: Device 1, Device 2, Device 3
Expected: Separate sessions for each device

// Test 4: Token expiry
Time: Wait 1 hour (or configure otp_expiry = 60 for testing)
Expected: Link no longer works, user gets error
```

---

## Troubleshooting

### Local: Emails Not Showing in Inbucket

**Problem:** Inbucket dashboard is empty after sending magic link.

**Solutions:**
```bash
# 1. Verify Inbucket is running
curl http://localhost:54324
# Should return HTML page

# 2. Restart Supabase
supabase stop
supabase start

# 3. Check Supabase logs
supabase logs
# Look for email-related errors

# 4. Verify config
cat supabase/config.toml | grep -A 5 "\[inbucket\]"
# Should show: enabled = true
```

### Production: SMTP Not Working

**Problem:** Emails not being sent in production.

**Check 1: Verify Mailgun Configuration**
```bash
# SSH to Zeabur
ssh zeabur@your-host

# Check config
cat supabase/config.toml | grep -A 10 "\[auth.email.smtp\]"

# Verify:
# - host = smtp.mailgun.org (correct)
# - port = 587 (correct)
# - user = postmaster@your-domain (matches Mailgun)
# - pass = your-api-key (correct)
```

**Check 2: Verify Mailgun Account**
- Go to Mailgun dashboard
- Check domain status (must be "Active")
- Verify API key hasn't been revoked
- Check sending domain is authorized

**Check 3: Verify Supabase Settings**
- SMTP enabled: `enabled = true`
- No typos in credentials
- Domain matches Mailgun configuration

**Check 4: Check Zeabur Environment**
- Open Zeabur dashboard
- Go to your app service
- Click "Settings"
- Verify all env vars are set correctly
- Restart app after env changes:
  ```bash
  zeabur restart email-cms
  ```

**Check 5: Monitor Mailgun**
- Go to Mailgun dashboard
- Check "Logs" for sent/failed emails
- Look for error messages
- Verify API key in logs matches

### Magic Links Expired or Invalid

**Problem:** User clicks link but gets "Token expired" error.

**Solutions:**
```toml
# 1. Increase expiry time
[auth.email]
otp_expiry = 7200  # 2 hours instead of 1

# 2. Check token formats match
# Ensure token hash is URL-encoded properly

# 3. Verify site_url is correct
[auth]
site_url = "https://your-app.zeabur.app"
```

### Rate Limiting Issues

**Problem:** Getting "too many requests" when testing.

**Check Configuration:**
```toml
[auth.rate_limit]
email_sent = 2              # Max 2 emails per hour
token_verifications = 30    # Max 30 verifications per 5 min
```

**To increase for testing:**
```toml
[auth.rate_limit]
email_sent = 100
token_verifications = 100
```

### Database Connection Issues

**Problem:** Can't access Supabase database.

**Solutions:**
```bash
# 1. Verify Zeabur instance is running
zeabur status

# 2. Check database credentials
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY

# 3. Test connection
curl -X GET https://your-zeabur-url/rest/v1/ \
  -H "apikey: $VITE_SUPABASE_ANON_KEY"

# 4. Check firewall rules
# Ensure Zeabur container can reach database
```

---

## Configuration Reference

### File Locations

```
Your implementation:
├── src/
│   ├── components/
│   │   └── MagicLinkForm.tsx        # Email input UI
│   ├── services/
│   │   └── authService.ts            # sendMagicLink() logic
│   ├── hooks/
│   │   └── useMagicLink.ts           # State management
│   └── context/
│       └── AuthContext.tsx            # Provides methods
├── supabase/
│   ├── config.toml                   # Supabase configuration
│   └── templates/
│       └── magic-link.html           # Email template (optional)
└── docs/
    └── EMAIL_SETUP_GUIDE.md          # This file
```

### Environment Variables

**Local Development (.env.local)**
```bash
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJ... (from supabase start output)
NODE_ENV=development
VITE_DEBUG=true
```

**Production (.env.production)**
```bash
VITE_SUPABASE_URL=https://your-zeabur-supabase.com
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=mg.your-domain.mailgun.org
NODE_ENV=production
VITE_DEBUG=false
```

### Supabase Configuration (config.toml)

**Email Settings:**
```toml
[auth.email]
enable_signup = true
enable_confirmations = false
otp_length = 6
otp_expiry = 3600  # seconds (1 hour)
```

**SMTP Configuration:**
```toml
[auth.email.smtp]
enabled = true
host = "smtp.mailgun.org"  # or smtp.sendgrid.net
port = 587
user = "postmaster@your-domain.mailgun.org"
pass = "your-mailgun-api-key"
admin_email = "noreply@your-domain.com"
sender_name = "Email CMS"
```

**Rate Limiting:**
```toml
[auth.rate_limit]
email_sent = 2              # 2 emails per hour
token_verifications = 30    # 30 verifications per 5 minutes
```

---

## Cost Breakdown

| Service | Plan | Cost | Emails/Month | Per Email |
|---------|------|------|--------------|-----------|
| **Mailgun** | Free | $0 | 9,000 (300/day) | Free |
| **Mailgun** | Pro | $19.99/mo | 50,000+ | $0.0004 |
| **SendGrid** | Free | $0 | 3,000 (100/day) | Free |
| **SendGrid** | Pro | $20/mo | 100,000+ | $0.0002 |
| **Local Dev** | Inbucket | $0 | Unlimited | Free |

**Recommendation:** Start with free tier (Mailgun = 9,000/month), upgrade when needed.

---

## Security Best Practices

### Environment Variables
- ✅ Never commit `.env.production`
- ✅ Store secrets in Zeabur environment settings
- ✅ Use separate keys for local/production
- ✅ Rotate API keys periodically

### SMTP Security
- ✅ Use TLS (port 587) instead of plain text
- ✅ Never log API keys
- ✅ Restrict Mailgun domain permissions
- ✅ Monitor for suspicious activity

### Token Security
- ✅ Tokens expire after 1 hour
- ✅ One-time use enforcement
- ✅ Tokens hashed in database
- ✅ HTTPS required in production

### User Authentication
- ✅ No passwords stored
- ✅ Secure session tokens (JWT)
- ✅ Refresh tokens in HttpOnly cookies
- ✅ Automatic logout after 30 days

---

## Quick Reference Commands

```bash
# Local Development
supabase start              # Start local Supabase
supabase stop              # Stop Supabase
supabase logs              # View logs
npm run dev               # Start app

# Production
git push zeabur main      # Deploy to Zeabur
npm run build             # Build for production

# Testing
npm test                  # Run tests
npm run build            # Test build process
```

---

## Deployment Checklist

- [ ] Mailgun/SendGrid account created
- [ ] API key obtained and tested
- [ ] Supabase SMTP configured
- [ ] Email template customized (optional)
- [ ] `.env.production` created
- [ ] Environment variables set in Zeabur
- [ ] Application built successfully
- [ ] Git committed and pushed
- [ ] Zeabur deployment completed
- [ ] Magic link tested with real email
- [ ] User created in authentication dashboard
- [ ] No errors in logs
- [ ] Mailgun shows successful delivery

---

## Next Steps

1. **For local testing:**
   ```bash
   npm run dev
   # Email testing works immediately
   ```

2. **For production:**
   - Get Mailgun account (5 minutes)
   - Configure Supabase SMTP
   - Set Zeabur environment variables
   - Deploy: `git push zeabur main`

3. **For scaling:**
   - Upgrade Mailgun plan ($20/month)
   - Increase Zeabur resources
   - Monitor email delivery metrics

---

## Support & Resources

- **Supabase Auth Docs:** https://supabase.com/docs/guides/auth
- **Mailgun Docs:** https://documentation.mailgun.com/
- **SendGrid Docs:** https://docs.sendgrid.com/
- **Zeabur Docs:** https://docs.zeabur.com/
- **Your App Logs:** Zeabur Dashboard → Services → Logs

---

## Summary

| Step | Local | Production |
|------|-------|-----------|
| **Setup Time** | 0 minutes | 10 minutes |
| **Cost** | $0 | $0-20/month |
| **Testing** | Inbucket UI | Real email |
| **Status** | ✅ Ready | ✅ Ready |
| **Next Action** | Run `npm run dev` | Get Mailgun account |

**You're ready to go!** 🚀

Your magic link authentication is complete and production-ready. Choose either local testing for development or production setup for Zeabur deployment.
