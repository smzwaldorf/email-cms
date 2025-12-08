# Analytics Troubleshooting Guide

## Common Issues

### 1. Stats Not Updating
**Symptoms**: Dashboard shows old data or 0 views.
**Possible Causes**:
- **Caching**: Dashboard computes stats on-demand or via materialized views. Ensure cache valid.
- **Ad Blockers**: Users with strict ad blockers may block the tracking pixel or script.
- **Deduplication**: Repeated opens/clicks within 10 seconds are ignored.

### 2. "Token Invalid" Errors
**Symptoms**: Pixel returns 400/500 or logs show verification failure.
**Fix**:
- Check `JWT_SECRET` in Edge Function secrets. Matches `Supabase Settings > API`.
- Ensure tokens are generated with correct `user_id` and `newsletter_id`.

### 3. Missing Page Views
**Symptoms**: Email opens tracked, but page views zero.
**Fix**:
- Verify `useAnalyticsTracking` hook is mounted.
- Check browser console for network errors (CSP blocking?).
- Ensure user is authenticated or guest session is active.

## Debugging Steps

1. **Check Edge Function Logs**:
   Go to Supabase Dashboard > Edge Functions > `tracking-pixel` > Logs.
   Look for "Event logged" or "Error".

2. **Verify Database**:
   Run SQL to check raw events:
   ```sql
   select * from analytics_events order by created_at desc limit 10;
   ```

3. **Test with Curl**:
   ```bash
   curl -v "https://[project].supabase.co/functions/v1/tracking-pixel?t=[token]"
   ```
