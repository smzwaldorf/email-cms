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
- Check `JWT_SECRET` in the backend service environment. It must match the signing secret used when tokens are generated.
- Ensure tokens are generated with correct `user_id` and `newsletter_id`.

### 3. Missing Page Views
**Symptoms**: Email opens tracked, but page views zero.
**Fix**:
- Verify `useAnalyticsTracking` hook is mounted.
- Check browser console for network errors (CSP blocking?).
- Ensure user is authenticated or guest session is active.

## Debugging Steps

1. **Check Backend Logs**:
   Inspect the backend service logs for `GET /api/tracking/pixel` and `GET /api/tracking/click`.
   Look for "Event logged" or "Error".

2. **Verify Database**:
   Run SQL to check raw events:
   ```sql
   select * from analytics_events order by created_at desc limit 10;
   ```

3. **Test with Curl**:
   ```bash
   curl -v "https://[backend-domain]/api/tracking/pixel?t=[token]"
   ```
