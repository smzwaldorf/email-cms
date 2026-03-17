# seed

### Reset Local Development Environment
When you need to fully reset local Supabase data and recreate development seed data:

Run the two commands together

1. Reset the local database and re-run migrations:
```bash
supabase db reset
```

2. Extract the local Supabase keys into `.env` from the local Supabase output (for example via `supabase status`). At minimum, store:
```bash
.env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
```

3. Recreate development seed data. The script reads `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env` at runtime, so no inline environment variables are needed:
```bash
npx tsx scripts/setup-development.ts
```