# Analytics Deployment Guide

## Prerequisites
- Supabase CLI installed.
- Deno installed (for local testing).

## Edge Functions
The analytics service relies on two Edge Functions:
1. `tracking-pixel`
2. `tracking-click`

### Deployment Steps
Run the following commands to deploy the functions to Supabase:

```bash
# Login
supabase login

# Deploy Pixel Function
supabase functions deploy tracking-pixel --no-verify-jwt

# Deploy Click Redirect Function
supabase functions deploy tracking-click --no-verify-jwt
```
> **Note**: We use `--no-verify-jwt` because these endpoints are public and handle their own JWT verification via the `t` parameter.

### Environment Variables
Set the following secrets for the functions:

```bash
supabase secrets set JWT_SECRET=your_jwt_signing_secret
supabase secrets set SUPABASE_URL=your_project_url
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Security Requirements**:
- `JWT_SECRET` must be at least 32 characters long (use `openssl rand -base64 32` to generate)
- Ensure `VITE_JWT_SECRET` is set in `.env.local` (frontend) with the same value
- All secrets should be rotated periodically (e.g., monthly)
- Never commit secrets to version control - use `.env.local` and `.env.secrets` files with .gitignore

## Database Migrations
Ensure migration `20251205000000_add_analytics_tables.sql` (and any fixes) is applied.

```bash
supabase db push
```

## Scheduled Tasks
If using `pg_cron` for analytics aggregation:
1. Enable `pg_cron` extension in Dashboard.
2. Run the cron setup migration (if applicable).
