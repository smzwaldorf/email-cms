# Magic Link Authentication Guide

Complete guide for Magic Link (OTP) passwordless authentication in local development and production.

---

## 📋 Table of Contents

1. [Quick Start (30 seconds)](#quick-start)
2. [How It Works](#how-it-works)
3. [Authentication Flow](#authentication-flow)
4. [Setup Instructions](#setup-instructions)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)
7. [Configuration Reference](#configuration-reference)
8. [Development vs Production](#development-vs-production)

---

## Quick Start

### 1️⃣ Start Everything

```bash
# Terminal 1: Start Supabase
supabase start

# Terminal 2: Start Dev Server
npm run dev
```

### 2️⃣ Open the App

- App: http://localhost:5173
- Inbucket (emails): http://localhost:54324

### 3️⃣ Test Magic Link Flow

**In App (http://localhost:5173)**:
1. Click **"Magic Link"** tab
2. Enter email: `test@example.com`
3. Click **"Send Magic Link"**
4. See confirmation message ✅

**In Inbucket (http://localhost:54324)**:
1. Refresh the page (if needed)
2. Click on the email from "noreply@localhost"
3. Copy the **6-digit OTP code** from the email body
4. Or click the **magic link** in the email

**Back in App**:
1. Paste the **6-digit code** in the confirmation field
2. Click **"Verify"**
3. You're logged in! 🎉

---

## How It Works

### Overview

Magic Link (OTP - One-Time Password) is a passwordless authentication method where users receive a time-limited link via email. Your local setup uses **Inbucket** - a local email testing server that captures emails instead of sending them.

### Local Development Flow

```
1. User enters email in MagicLinkForm.tsx
   ↓
2. Frontend calls sendMagicLink(email)
   ↓
3. Supabase generates 6-digit OTP code
   ↓
4. Email captured by Inbucket (local testing)
   ↓
5. User extracts code from Inbucket UI
   ↓
6. Frontend calls verifyMagicLink(token)
   ↓
7. User authenticated & session created
```

---

## Authentication Flow

### Complete User Journey Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                              │
│                                                                      │
│  http://localhost:5173 (Your React App)                             │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ LoginPage Component                                          │   │
│  │                                                              │   │
│  │  [Google OAuth] [Magic Link] [Email/Password]              │   │
│  │                    ↓                                         │   │
│  │  MagicLinkForm.tsx                                          │   │
│  │  • Input email field                                        │   │
│  │  • Send Magic Link button                                   │   │
│  │  • OTP verification field                                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│           │                                          ▲               │
│           │                                          │               │
│    [1] Enter Email   [2] User submits             [5] Verify OTP    │
│           │                                          │               │
└───────────┼──────────────────────────────────────────┼───────────────┘
            │                                          │
            ▼                                          │
┌─────────────────────────────────────────────────────┼────────────────┐
│                   SUPABASE (Local)                  │                │
│                 http://localhost:54321              │                │
│                                                     │                │
│  ┌──────────────────────────────────────────────┐  │                │
│  │ authService.ts                               │  │                │
│  │                                              │  │                │
│  │ async sendMagicLink(email):                  │  │                │
│  │  • Call supabase.auth.signInWithOtp(email)  │  │                │
│  │  • Generate OTP token                        │  │                │
│  │  • Create 6-digit code                       │  │                │
│  └──────────────────────────────────────────────┘  │                │
│           │                                         │                │
│    [3] Generate OTP & Token                        │                │
│           │                                         │                │
│           ▼                                         │                │
│  ┌──────────────────────────────────────────────┐  │                │
│  │ PostgreSQL Auth Database                     │  │                │
│  │                                              │  │                │
│  │ ┌─ auth.otp_tokens ──────────────────────┐ │  │                │
│  │ │ • user_id: uuid                        │ │  │                │
│  │ │ • email: "user@example.com"            │ │  │                │
│  │ │ • code: "123456"                       │ │  │                │
│  │ │ • token_hash: "abc123xyz..."           │ │  │                │
│  │ │ • created_at: now()                    │ │  │                │
│  │ │ • expires_at: now() + 1 hour           │ │  │                │
│  │ │ • used_at: NULL (not used yet)         │ │  │                │
│  │ └────────────────────────────────────────┘ │  │                │
│  └──────────────────────────────────────────────┘  │                │
│           │                                         │                │
└───────────┼─────────────────────────────────────────┼────────────────┘
            │                                         │
            ▼                                         │
┌───────────────────────────────────────────────────┬─┼────────────────┐
│              INBUCKET (Email Testing)             │ │                │
│            http://localhost:54324                │ │                │
│                                                  │ │                │
│  ┌────────────────────────────────────────────┐ │ │                │
│  │ Email Captured & Stored                    │ │ │                │
│  │                                            │ │ │                │
│  │ From: noreply@localhost                    │ │ │                │
│  │ To: user@example.com                       │ │ │                │
│  │ Subject: Confirm your signup               │ │ │                │
│  │                                            │ │ │                │
│  │ Body:                                      │ │ │                │
│  │ ─────────────────────────────────────────  │ │ │                │
│  │ Your OTP code: 123456                      │ │ │                │
│  │                                            │ │ │                │
│  │ Or click: http://localhost:5173/...code.. │ │ │                │
│  │ ─────────────────────────────────────────  │ │ │                │
│  │                                            │ │ │                │
│  │ [4] User views email, copies code ────────┤─┤─┘                │
│  └────────────────────────────────────────────┘ │                  │
│                                                  │                  │
└──────────────────────────────────────────────────┘                  │
```

### Sequence Diagram

```
User              App                  Supabase         Inbucket
 │                 │                      │                │
 │─ "Send Link" ─→ │                      │                │
 │                 │── signInWithOtp() ──→ │                │
 │                 │                      │─ Generate OTP → │
 │                 │                      │─ Email token ──→ │
 │                 │←─ Success ───────────│                │
 │←─ Confirmation ─│                      │                │
 │                 │                      │                │
 │─ Check Email ─→ (Check Inbucket UI)   │                │
 │                 │                      │              ┌──┐
 │                 │                      │              │  │ Email appears:
 │                 │                      │              │  │ "OTP: 123456"
 │                 │                      │              └──┘
 │                 │                      │                │
 │─ Copy Code ─── (Copy from Inbucket)   │                │
 │                 │                      │                │
 │─ Enter Code ──→ │                      │                │
 │                 │── verifyOtp() ──────→ │                │
 │                 │                      │ Check & Mark used
 │                 │←─ Success ───────────│                │
 │←─ Logged In ────│                      │                │
 │                 │                      │                │
```

### Code Flow

**1. User Sends Magic Link**

File: `src/components/MagicLinkForm.tsx`
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  const success = await sendMagicLink(email)  // ← Call auth service
  if (success) {
    setStep('confirm')  // Show OTP input
  }
}
```

**2. Service Calls Supabase**

File: `src/services/authService.ts`
```typescript
async sendMagicLink(email: string): Promise<boolean> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  return !error
}
```

**3. Supabase Generates Token**

In Supabase (PostgreSQL):
- Generate 6-digit OTP code
- Hash the token
- Store in `auth.otp_tokens` with expiry
- Send email via Inbucket

**4. Email Captured in Inbucket**

In Inbucket:
- Email stored locally
- Accessible at http://localhost:54324
- Shows OTP code and/or magic link

**5. User Enters OTP**

File: `src/components/MagicLinkForm.tsx`
```typescript
const handleVerify = async () => {
  const user = await verifyMagicLink(otpCode)  // ← Call auth service
  if (user) {
    onSuccess()  // Redirect to dashboard
  }
}
```

**6. Service Verifies Token**

File: `src/services/authService.ts`
```typescript
async verifyMagicLink(token: string): Promise<AuthUser | null> {
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: token,
    type: 'email',
  })

  if (data.user?.id) {
    await this.setCurrentUser(data.user.id)
    return this.currentUser
  }
  return null
}
```

**7. Authentication Complete**

- Supabase creates session
- JWT token issued
- User logged in
- Redirect to latest week dashboard

---

## Setup Instructions

### Prerequisites

Your `supabase/config.toml` is already configured with optimal settings:

```toml
[inbucket]
enabled = true
port = 54324  # Web interface for viewing emails

[auth.email]
enable_signup = true
enable_confirmations = false
otp_length = 6
otp_expiry = 3600  # 1 hour expiry

[auth.rate_limit]
email_sent = 2  # Max 2 emails per hour in local dev
```

### Step 1: Ensure Supabase is Running

```bash
# Start local Supabase (if not already running)
supabase start
```

You should see output like:
```
Inbucket URL: http://localhost:54324
```

### Step 2: Verify Inbucket is Accessible

Open in browser: **http://localhost:54324**

You should see the Inbucket web interface (email inbox for testing).

### Step 3: Start Dev Server

```bash
npm run dev
```

Navigate to: **http://localhost:5173**

### Step 4: Test Magic Link Flow

#### Using the App (Recommended)

1. Click **"Magic Link"** tab on login page
2. Enter any email (e.g., `test@example.com`)
3. Click **"Send Magic Link"**
4. Check Inbucket at **http://localhost:54324**:
   - You should see an email from "noreply@localhost"
   - Subject: "Confirm your signup"
   - Copy the **6-digit OTP code** from the email
5. Return to app and enter the OTP code
6. You should be authenticated ✅

#### Using Test OTP (Optional)

Add to `supabase/config.toml`:
```toml
[auth.email.test_otp]
test@example.com = "000000"  # Any 6-digit code
```

Then in development, you can use `000000` as the code for `test@example.com`.

### Step 5: Verify Email Content

In Inbucket UI:
- Email FROM: `noreply@localhost`
- Email TO: User's entered email
- Body contains: **Magic link** or **OTP code**
- Link format: `http://localhost:5173/auth/callback?code=xxxxx&type=email`

---

## Testing

### What You'll See in Inbucket

**Email Details**:
- From: `noreply@localhost`
- To: Your entered email
- Subject: `Confirm your signup` or `Confirm your email change`
- Body: Contains OTP code like `123456` or a link with token

### Test Users

Try these emails with the magic link:
- `parent1@example.com`
- `teacher@example.com`
- `admin@example.com`
- Or any email you want to test with

### Token Lifecycle

```
1. TOKEN GENERATION
   └─ Called: sendMagicLink(email)
      └─ OTP Code: 123456 (6 digits)
      └─ Token Hash: abc123xyz... (secure hash)
      └─ Created: 2025-11-27T10:00:00Z
      └─ Expires: 2025-11-27T11:00:00Z (1 hour later)
      └─ Used: NULL

2. EMAIL SENT & CAPTURED
   └─ Email Service: Inbucket
      └─ Captures to DB
      └─ Available in UI

3. USER ENTERS OTP
   └─ Called: verifyMagicLink(token)

4. TOKEN VERIFICATION
   ├─ Check if token exists
   ├─ Check if expired (used_at is NULL)
   ├─ Check if valid (matches code)
   └─ If all valid:
      ├─ Mark as used: used_at = now()
      ├─ Create session
      ├─ Issue JWT token
      └─ Redirect to app

5. TOKEN CLEANUP
   └─ Automatic after expiry
   └─ Never reusable (used_at marked)
```

### Error Scenarios

**Scenario 1: Token Expires**
```
Time: 0:00      User requests magic link
Time: 0:05      User checks email
Time: 1:30      User tries to verify ← FAILS (token expired after 1 hour)

Solution: Request new magic link
```

**Scenario 2: Token Already Used**
```
Time: 0:05      User enters code #1 → SUCCESS
Time: 0:10      User tries same code again → FAILS (already used)

Solution: Request new magic link
```

**Scenario 3: Rate Limited**
```
Attempt #1: User requests magic link → SUCCESS
Attempt #2: User requests magic link → SUCCESS
Attempt #3: User requests magic link → RATE LIMITED (max 2/hour)

Solution: Wait 1 hour or increase email_sent in config
```

### Testing Checklist

- [ ] Send magic link from UI
- [ ] Email appears in Inbucket immediately
- [ ] OTP code is 6 digits
- [ ] Magic link contains correct redirect URL
- [ ] Copy and enter OTP code
- [ ] User authenticates successfully
- [ ] Test with different email addresses
- [ ] Test token expiry (wait or change config)
- [ ] Test rate limiting (exceed limit)
- [ ] Verify session is created
- [ ] Verify JWT token is valid

---

## Troubleshooting

### Issue: "Email sending disabled"

**Solution**: Ensure `[inbucket] enabled = true` in `supabase/config.toml`

```bash
supabase stop
supabase start
```

### Issue: Email not appearing in Inbucket

**Check**:
1. Is Inbucket running? (http://localhost:54324 should load)
2. Is port 54324 available?
3. Check browser console for errors
4. Check Supabase logs: `supabase logs --local`

```bash
# View Supabase logs
supabase logs --local
```

### Issue: Rate limit error (2 emails/hour)

In `supabase/config.toml`:
```toml
[auth.rate_limit]
email_sent = 10  # Increase for local testing
```

Then:
```bash
supabase stop
supabase db reset
supabase start
```

### Issue: "Invalid token" when verifying

**Possible causes**:
1. Token expired (1 hour default)
2. Token already used once
3. Token format mismatch

**Solution**: Request a new magic link

---

## Configuration Reference

### Current Local Configuration

Your `supabase/config.toml` has:

```toml
[inbucket]
enabled = true
port = 54324

[auth.email]
enable_signup = true              # Allow signup via email
enable_confirmations = false      # Don't require email confirmation
otp_length = 6                    # 6-digit OTP code
otp_expiry = 3600                 # 1 hour expiry
max_frequency = "1s"              # Min time between requests

[auth.rate_limit]
email_sent = 2                    # Max 2 emails per hour (local dev)
token_verifications = 30          # Max 30 verifications per 5 min
sign_in_sign_ups = 30            # Max 30 sign-in attempts per 5 min
```

### Customizing Magic Link Settings

#### Change OTP Expiry

In `supabase/config.toml`:
```toml
[auth.email]
otp_expiry = 1800  # 30 minutes instead of 1 hour
```

Then reset:
```bash
supabase db reset
```

#### Change OTP Length

```toml
[auth.email]
otp_length = 8  # Instead of 6 digits
```

#### Customize Email Template

Create `supabase/templates/recovery.html`:
```toml
[auth.email.template.recovery]
subject = "Your Magic Link"
content_path = "./supabase/templates/recovery.html"
```

Then customize the HTML template for email content.

### Port Map

- Supabase API: `http://localhost:54321`
- PostgreSQL: `localhost:54322`
- Supabase Studio: `http://localhost:54323`
- **Inbucket (Emails): `http://localhost:54324`**
- Analytics: `http://localhost:54327`

### Environment Variables

**File**: `.env.local`
```bash
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<local-anon-key>
```

Get your local anon key from:
```bash
supabase status
```

---

## Development vs Production

| Aspect | Local Dev | Production |
|--------|-----------|-----------|
| Email Server | Inbucket (captures) | SendGrid/AWS SES |
| Email View | http://localhost:54324 | User's mailbox |
| Rate Limit | 2/hour (changeable) | Project-based |
| Expiry | 1 hour (configurable) | 1 hour |
| Nonce Check | Skipped for local OAuth | Required |
| Cost | Free | Varies by email service |

### Switching to Production Email

For production, configure a real email service:

**SendGrid Example**:
```toml
[auth.email.smtp]
enabled = true
host = "smtp.sendgrid.net"
port = 587
user = "apikey"
pass = "env(SENDGRID_API_KEY)"
admin_email = "noreply@yourdomain.com"
sender_name = "Your App"
```

---

## Implementation Status

### ✅ Completed

- [x] Inbucket configured for local email testing
- [x] Magic Link (OTP) enabled in auth config
- [x] Email expiry set to 1 hour
- [x] Rate limiting configured (2 emails/hour)
- [x] MagicLinkForm.tsx component
- [x] sendMagicLink() and verifyMagicLink() methods
- [x] Integrated into LoginPage

### ⏳ Pending

- [ ] Magic link send Edge Function (T036)
- [ ] Magic link verify Edge Function (T037)
- [ ] useMagicLink hook (T039)
- [ ] End-to-end testing (T043)

### Next Steps for Production

1. **T036**: Implement Edge Function for sending magic links
2. **T037**: Implement Edge Function for verifying tokens
3. **T039**: Create useMagicLink hook for state management
4. **Replace Inbucket**: Switch from Inbucket to SendGrid/AWS SES
5. **Add Customization**: Branded email templates
6. **Testing**: Complete end-to-end testing with real emails

---

## Related Documentation

- [Supabase Auth Email OTP](https://supabase.com/docs/guides/auth/auth-email-otp)
- [Supabase Local Development](https://supabase.com/docs/guides/local-development)
- [Inbucket Email Testing](https://www.inbucket.org/)
- [Magic Link Flow Diagram](./MAGIC_LINK_FLOW.md) - Visual diagrams

---

## Related Tasks

- **T012**: Configure Magic Link (✅ Completed)
- **T034**: MagicLinkForm component (✅ Implemented)
- **T035**: authService magic link methods (✅ Implemented)
- **T036**: Magic link backend edge function (⏳ Pending)
- **T037**: Magic link verification backend (⏳ Pending)
- **T043**: Complete end-to-end testing (⏳ Pending)

---

**Last Updated**: 2025-11-27
**Status**: Ready for local testing ✅
