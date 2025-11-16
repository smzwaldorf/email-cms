# Login System Setup Guide

This document provides complete instructions for setting up the passwordless authentication system for the Email CMS application.

## Overview

The login system implements:
- **Passwordless Authentication** via Google OAuth 2.0 and Email Magic Links
- **User Roles**: ADMIN, CLASS_TEACHER, PARENT, STUDENT
- **Row-Level Security** (RLS) with Supabase
- **Multi-device Support** via JWT tokens

## Prerequisites

1. Node.js 18+ installed
2. Supabase account (free tier is sufficient for testing)
3. Google Cloud Console account (for OAuth)

---

## Step 1: Supabase Project Setup

### 1.1 Create Supabase Project

1. Visit [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Choose organization and enter project details:
   - **Name**: email-cms
   - **Database Password**: Generate a strong password (save it securely)
   - **Region**: Choose closest to your users
4. Click **"Create new project"** and wait for provisioning (~2 minutes)

### 1.2 Run Database Migration

1. In Supabase Dashboard, navigate to **SQL Editor**
2. Click **"New query"**
3. Copy the entire contents of `supabase-migration.sql`
4. Paste into the SQL editor
5. Click **"Run"** to execute the migration
6. Verify success: Check the **Table Editor** to see new tables created

### 1.3 Get API Credentials

1. Navigate to **Settings** > **API**
2. Copy the following values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...` (long string)
3. Update your `.env.local` file:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...your-actual-key...
VITE_APP_URL=http://localhost:5173
VITE_APP_NAME=電子報 CMS
```

---

## Step 2: Google OAuth Setup

### 2.1 Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **"Create Credentials"** > **"OAuth 2.0 Client ID"**
5. Configure consent screen (if first time):
   - User type: External
   - App name: Email CMS
   - Support email: Your email
   - Add scopes: `email`, `profile`
6. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: Email CMS Web
   - Authorized redirect URIs:
     - `https://xxxxx.supabase.co/auth/v1/callback` (replace xxxxx with your project ID)
     - `http://localhost:54321/auth/v1/callback` (for local development if using self-hosted)
7. Click **"Create"** and save:
   - **Client ID**: `xxxxx.apps.googleusercontent.com`
   - **Client Secret**: `GOCSPX-xxxxx`

### 2.2 Configure Google Auth in Supabase

1. In Supabase Dashboard, go to **Authentication** > **Providers**
2. Find **Google** and click to expand
3. Enable the provider
4. Paste your **Client ID** and **Client Secret**
5. Click **"Save"**

---

## Step 3: Email Magic Link Setup

### 3.1 Configure Email Provider in Supabase

1. Go to **Authentication** > **Providers**
2. Ensure **Email** is enabled (should be enabled by default)
3. Configure email templates (optional):
   - Navigate to **Authentication** > **Email Templates**
   - Customize the **Magic Link** template
   - Use placeholders: `{{ .ConfirmationURL }}`, `{{ .Email }}`

### 3.2 Configure SMTP (Production Only)

For production, configure a custom SMTP server:

1. Go to **Settings** > **Auth** > **SMTP Settings**
2. Enable **Custom SMTP**
3. Enter SMTP credentials:
   - **Host**: smtp.sendgrid.net (or your provider)
   - **Port**: 587
   - **Username**: apikey
   - **Password**: Your SendGrid API key
   - **Sender email**: noreply@yourdomain.com
   - **Sender name**: Email CMS

For development, Supabase provides email delivery automatically.

---

## Step 4: Application Configuration

### 4.1 Install Dependencies

```bash
cd email-cms
npm install
```

Dependencies are already added to `package.json`:
- `@supabase/supabase-js` - Supabase client library

### 4.2 Configure Environment Variables

Create `.env.local` file in project root (already created):

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# App Configuration
VITE_APP_URL=http://localhost:5173
VITE_APP_NAME=電子報 CMS
```

**Important:** Never commit `.env.local` to Git. It's already in `.gitignore`.

### 4.3 Update Supabase Auth URLs

1. In Supabase Dashboard, go to **Authentication** > **URL Configuration**
2. Set **Site URL**: `http://localhost:5173` (development) or `https://yourdomain.com` (production)
3. Add **Redirect URLs**:
   - `http://localhost:5173/auth/callback`
   - `https://yourdomain.com/auth/callback` (for production)

---

## Step 5: Create Admin User

### 5.1 Sign Up First User

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Visit `http://localhost:5173/login`

3. Sign in using Google OAuth or Magic Link

4. This creates your first user account

### 5.2 Promote User to Admin

1. In Supabase Dashboard, go to **Table Editor** > **profiles**
2. Find your user by email
3. Click to edit the row
4. Change `role` from `PARENT` to `ADMIN`
5. Save changes

Now you have admin access!

---

## Step 6: Testing the Authentication Flow

### 6.1 Test Google OAuth

1. Visit `http://localhost:5173`
2. You should be redirected to `/login`
3. Click **"使用 Google 帳號登入"**
4. Authorize the application
5. You should be redirected back and logged in

### 6.2 Test Email Magic Link

1. Visit `http://localhost:5173/login`
2. Enter your email address
3. Click **"發送魔法連結"**
4. Check your email inbox (or spam folder)
5. Click the magic link
6. You should be logged in

### 6.3 Test Protected Routes

1. While logged in, navigate to `/week/2025-W43`
2. Sign out (if you've added a logout button)
3. Try to access `/week/2025-W43` again
4. You should be redirected to `/login`

---

## Step 7: User Management

### 7.1 Create Additional Users (Admin Only)

As an admin, you can create user accounts manually:

1. In Supabase Dashboard, go to **Table Editor** > **profiles**
2. Click **"Insert"** > **Insert row**
3. Fill in user details:
   - `id`: (will auto-generate via auth trigger)
   - `email`: user@example.com
   - `role`: CLASS_TEACHER | PARENT | STUDENT
   - `first_name`: User's first name
   - `last_name`: User's last name
   - `is_active`: true
   - `email_verified`: false (will be verified on first login)

Or use the Supabase Auth API to create users programmatically.

### 7.2 Assign Roles

User roles control access:

- **ADMIN**: Full system access, can manage all content and users
- **CLASS_TEACHER**: Manage own classes, create class articles
- **PARENT**: View children's class content only
- **STUDENT**: View own class content only

Change roles in the `profiles` table.

---

## Step 8: Deployment to Production

### 8.1 Update Environment Variables

For production deployment (e.g., Zeabur, Vercel, Netlify):

1. Set environment variables in your hosting platform:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_production_anon_key
   VITE_APP_URL=https://yourdomain.com
   VITE_APP_NAME=電子報 CMS
   ```

2. Update Google OAuth redirect URIs:
   - Add `https://yourdomain.com/auth/callback`
   - Add `https://your-project.supabase.co/auth/v1/callback`

3. Update Supabase Auth URLs:
   - Site URL: `https://yourdomain.com`
   - Redirect URLs: `https://yourdomain.com/auth/callback`

### 8.2 Build and Deploy

```bash
# Build for production
npm run build

# Deploy dist/ folder to your hosting platform
# Or follow platform-specific deployment instructions
```

---

## Troubleshooting

### Issue: "Missing Supabase environment variables"

**Solution**: Ensure `.env.local` file exists with correct values. Restart dev server after creating/updating `.env.local`.

### Issue: Google OAuth fails with "redirect_uri_mismatch"

**Solution**:
1. Check Google Cloud Console > Credentials > OAuth 2.0 Client
2. Ensure redirect URI exactly matches: `https://xxxxx.supabase.co/auth/v1/callback`
3. Wait 5 minutes for Google to propagate changes

### Issue: Magic link email not received

**Solution**:
1. Check spam folder
2. Verify email provider is configured in Supabase
3. For development, check Supabase Dashboard > **Authentication** > **Logs**
4. Ensure email template is enabled

### Issue: User logged in but gets "Unauthorized" errors

**Solution**:
1. Check Row Level Security (RLS) policies in Supabase
2. Verify user role is set correctly in `profiles` table
3. Check browser console for error messages

### Issue: "Invalid JWT" or token expired errors

**Solution**:
1. Tokens auto-refresh, but check browser localStorage for `supabase.auth.token`
2. Clear browser cache and re-login
3. Verify `VITE_SUPABASE_ANON_KEY` is correct

---

## Security Best Practices

1. **Never commit** `.env.local` or `.env` files to Git
2. **Use strong SMTP credentials** for production email delivery
3. **Enable email verification** for sensitive operations
4. **Regularly review** authentication audit logs in `auth_audit_log` table
5. **Set up rate limiting** for authentication endpoints (built into Supabase)
6. **Use HTTPS** in production (required for secure cookies)
7. **Enable Row Level Security** on all tables (already done in migration)
8. **Limit ADMIN role** to only necessary users

---

## Next Steps

1. **Add user profile page** for users to view/edit their profile
2. **Implement role-based UI** to show/hide features based on user role
3. **Add audit logging** for sensitive operations
4. **Set up email notifications** for new articles
5. **Create admin dashboard** for user management
6. **Add family management** interface for admins
7. **Implement class management** for admins and teachers

---

## Resources

- [Supabase Authentication Docs](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 Setup](https://developers.google.com/identity/protocols/oauth2)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Project Documentation](./specs/docs/)

---

## Support

For issues or questions:
1. Check Supabase Dashboard > **Logs** for error details
2. Review browser console for client-side errors
3. Check `auth_audit_log` table for authentication events
4. Consult the documentation in `specs/docs/`

---

**Version**: 1.0
**Last Updated**: 2025-11-16
**Author**: Claude Code Implementation
