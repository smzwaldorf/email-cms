# Analytics Deployment Guide

## Prerequisites
- Supabase CLI installed for database migrations.
- Backend service runtime configured.

## Backend Routes
The analytics service relies on two public backend routes:
1. `GET /api/tracking/pixel`
2. `GET /api/tracking/click`

### Deployment Steps
Deploy the backend service and expose it over HTTPS. No Supabase Edge Function deployment is required.

```bash
npm run backend:build
npm run start -w @email-cms/backend
```
> **Note**: These endpoints are public and handle their own JWT verification via the `t` parameter.

### Environment Variables
Set the following secrets for the backend service:

```bash
JWT_SECRET=your_jwt_signing_secret
VITE_SUPABASE_URL=your_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
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
