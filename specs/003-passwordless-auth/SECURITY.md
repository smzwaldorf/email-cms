# Security & Audit Logging (Phase 7)

## Overview

This document describes the security features and audit logging implementation for the Email CMS Newsletter Viewer application. Phase 7 introduces comprehensive authentication event logging, suspicious activity detection, and admin session management capabilities.

## Authentication Event Types

The system logs the following authentication events:

| Event Type | Auth Method | Logged When | User ID |
|---|---|---|---|
| `login_success` | Email/Password | Successful password login | Yes (user authenticated) |
| `login_failure` | Email/Password | Failed password login attempt | No (user not authenticated) |
| `logout` | Any | User signs out | Yes (user authenticated) |
| `oauth_google_start` | Google OAuth | OAuth flow initiated | No (redirect happens) |
| `oauth_google_success` | Google OAuth | OAuth login completed | Yes (user authenticated) |
| `oauth_google_failure` | Google OAuth | OAuth login failed | No (auth failed) |
| `magic_link_sent` | Magic Link | Magic link email sent | No (user not authenticated yet) |
| `magic_link_verified` | Magic Link | Magic link token verified | Yes (user authenticated) |
| `magic_link_expired` | Magic Link | Magic link verification failed/expired | No (token invalid) |
| `token_refresh_success` | Any | Session token refreshed | Yes (user authenticated) |
| `token_refresh_failure` | Any | Token refresh failed | Yes (user had session) |
| `session_expired` | Any | User session expired | Yes (session was active) |

## Authentication Methods

The system supports three authentication methods:

| Method | Description | Rate Limiting | Use Cases |
|---|---|---|---|
| `email_password` | Traditional email + password login | 5 attempts/hour per email | Teachers, admins |
| `magic_link` | Email-based magic link login | 60s between requests per email | Teachers, parents |
| `google_oauth` | Google OAuth 2.0 flow | Google-managed rate limiting | Teachers, parents, optional for admins |

## Audit Events Table Schema

```sql
CREATE TABLE public.auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),        -- NULL for pre-auth events
  event_type VARCHAR(30) NOT NULL,                 -- See event types table
  auth_method VARCHAR(20),                         -- See auth methods table
  ip_address INET,                                 -- NULL (client-side logging)
  user_agent TEXT,                                 -- Browser/device identification
  metadata JSONB,                                  -- Additional context
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Metadata Examples

**Magic Link Sent:**
```json
{ "email": "user@example.com" }
```

**Login Failure:**
```json
{ "email": "user@example.com", "error": "Invalid credentials" }
```

**Admin Force Logout:**
```json
{ "action": "admin_force_logout", "targetUserId": "uuid-123..." }
```

**OAuth Failure:**
```json
{ "error": "oauth_error_message" }
```

## Data Retention

- **Retention Period:** 30 days
- **Auto-Cleanup:** PostgreSQL cron job runs daily at 2:00 AM UTC
- **Cleanup Query:** Deletes events older than 30 days
- **Rationale:** GDPR-compliant data minimization; old events rarely needed for active investigations

## Rate Limiting

### Supabase Native Rate Limiting

The system relies on Supabase's built-in rate limiting:

- **Magic Links:** 60 seconds between requests per email (Supabase default)
- **Password Login:** 5 attempts per hour per email (Supabase default)
- **OAuth:** No rate limiting (Google handles this)

### Suspicious Activity Detection

The AdminDashboard automatically detects suspicious activity:

**Threshold:** >5 failed login attempts within 15 minutes

**Detection:**
```sql
SELECT user_id, COUNT(*) as failure_count
FROM auth_events
WHERE event_type = 'login_failure'
  AND created_at > NOW() - INTERVAL '15 minutes'
GROUP BY user_id
HAVING COUNT(*) > 5
```

**Display:** Red alert banner in AdminDashboard with list of suspicious users

**Check Frequency:** Every 5 minutes via `setInterval`

**Admin Actions Available:**
1. View detailed audit logs for the user
2. Force logout all sessions for the user
3. View user information and roles

## Admin Capabilities

### Force Logout

**Purpose:** Immediately invalidate all sessions for a user (e.g., compromised account)

**Implementation:**
```typescript
await supabaseAdmin.auth.admin.signOut(userId)
```

**What Happens:**
1. All sessions for the user are invalidated
2. User must re-authenticate to access the system
3. Action is logged to audit_events with admin_id and target_user_id
4. All active sessions become invalid (Supabase manages this)

**UI Location:** Actions column in User Management table (orange "Force Logout" button)

**Confirmation:** Requires admin confirmation dialog before executing

### Audit Log Viewer

**Location:** Admin Dashboard → Audit Logs tab

**Features:**
- **View:** All authentication events in table format
- **Filter by Auth Method:** Google OAuth, Magic Link, Email/Password, All
- **Filter by Event Type:** Dropdown with all 12 event types
- **Filter by Time Range:** 1 day, 7 days, 30 days, 90 days
- **Export to CSV:** Download audit logs for external analysis
- **Pagination:** 25 events per page
- **Expand Metadata:** Click "View" to see full metadata JSON for each event

**Columns:**
- Timestamp (ISO format, user's local timezone)
- User (first 8 chars of UUID)
- Event Type (color-coded: green=success, red=failure, orange=warning)
- Auth Method (Google OAuth, Magic Link, Email/Password, or -)
- Device (User agent truncated to 40 chars)
- Details (Expandable metadata)

**RLS Access:** Admins can view all events; users can only view their own

## Security Best Practices

### 1. Regular Audit Review

- Review audit logs weekly for suspicious patterns
- Look for:
  - Repeated failed login attempts
  - Logins from unusual times/locations
  - Multiple successful logins in quick succession

### 2. Immediate Force Logout Triggers

Force logout a user immediately if you detect:
- Account compromise (suspicious activity alert)
- Failed verification during password reset
- Unrecognized access patterns
- User reports unauthorized access

### 3. Data Minimization

- Audit logs are automatically deleted after 30 days
- No archival to cold storage (adjust if compliance requires longer retention)
- Metadata only includes essential context (errors, email, IDs)
- No sensitive data (passwords, tokens) ever logged

### 4. User Education

- Advise users to use strong, unique passwords
- Recommend magic link authentication (no password to compromise)
- Suggest enabling OAuth where available
- Educate on phishing risks (especially magic link emails)

### 5. Monitoring

- Set up alerts for:
  - >10 failed logins from same IP in 1 hour
  - >3 successful logins from different countries in 1 day
  - Force logout events (track admin actions)

## Integrations

### AuthContext

All authentication operations automatically log to auth_events:

```typescript
// In authService.ts
await auditLogger.logAuthEvent({
  userId,
  eventType: 'login_success',
  authMethod: 'email_password'
})
```

### Admin Dashboard

Suspicious activity detection runs automatically:

```typescript
const checkSuspicious = async () => {
  const suspicious = await adminSessionService.detectSuspiciousActivity()
  setSuspiciousUsers(suspicious)  // Updates red alert banner
}

// Runs every 5 minutes
const interval = setInterval(checkSuspicious, 5 * 60 * 1000)
```

### Force Logout Handler

```typescript
const handleForceLogout = async (userId: string) => {
  const success = await adminSessionService.forceLogoutUser(
    userId,
    currentAdminUserId
  )
  // User is immediately logged out from all devices
}
```

## Testing

### Unit Tests

- `auditLogger.test.ts` - Verify logging service correctly inserts events
- `adminSessionService.test.ts` - Verify force logout and detection logic

### Integration Tests

- `audit-logging.test.ts` - E2E authentication flow logging
- `admin-session-management.test.ts` - E2E admin operations

### Test Coverage

- Target: >85% code coverage for new Phase 7 code
- Current: ~38+ integration tests covering:
  - Magic link logging
  - OAuth logging
  - Login failure logging
  - Suspicious activity detection
  - Force logout execution
  - Audit log export

## Troubleshooting

### Events Not Being Logged

1. **Check:** Is auth_events table created? Run migration:
   ```bash
   supabase migration up
   ```

2. **Check:** Is auditLogger service imported in authService?
   ```typescript
   import { auditLogger } from './auditLogger'
   ```

3. **Check:** Are logging calls awaited?
   ```typescript
   await auditLogger.logAuthEvent(...)  // Correct
   auditLogger.logAuthEvent(...)        // Async but not awaited - OK
   ```

4. **Check:** RLS policies allow inserts?
   - Service role should be used for inserts
   - Check auth_events RLS policies

### Suspicious Activity Alert Not Showing

1. **Check:** Is detectSuspiciousActivity() being called?
   - Should run every 5 minutes in AdminDashboard effect

2. **Check:** Is threshold >5 failures being met?
   - Run query: `SELECT COUNT(*) FROM auth_events WHERE event_type='login_failure' AND created_at > NOW() - INTERVAL '15 minutes'`

3. **Check:** User IDs are being logged correctly
   - Failed logins should have user_id=NULL (not authenticated yet)
   - Verify with: `SELECT user_id, COUNT(*) FROM auth_events WHERE event_type='login_failure' GROUP BY user_id`

### Force Logout Not Working

1. **Check:** Is Supabase service key configured?
   - Service key required for admin operations
   - Check environment variables

2. **Check:** User has active sessions
   - Use Supabase dashboard to verify sessions exist

3. **Check:** Admin has proper permissions
   - User must have 'admin' role in user_roles table

## Compliance

This implementation supports:

- **GDPR:** 30-day data retention, data minimization, user access rights
- **SOC 2:** Comprehensive audit trail, admin access controls, secure logging
- **Educational Privacy:** Event types don't log sensitive academic data
- **FERPA (US):** No student data in audit logs, appropriate access controls

## Future Enhancements

Potential Phase 8+ improvements:

1. **Real-Time Alerts** - WebSocket-based alerts instead of 5-min polling
2. **Advanced Filtering** - Search by username, IP range, device type
3. **Alert Thresholds** - Configurable suspicious activity thresholds per admin
4. **Archived Logs** - Move old logs to cold storage instead of deletion
5. **Email Alerts** - Send admin notifications for suspicious activity
6. **Geo-Blocking** - Block logins from unexpected countries
7. **Device Fingerprinting** - Track device fingerprints for unusual access
8. **API Rate Limiting** - Per-user API rate limits for programmatic access

## Related Documentation

- [API.md](./API.md) - Auth endpoints and error handling
- [SETUP.md](./SETUP.md) - Auth configuration and migration instructions
- [TESTING.md](./TESTING.md) - Auth testing patterns and utilities
- [README.md](../../README.md) - Overview and architecture
