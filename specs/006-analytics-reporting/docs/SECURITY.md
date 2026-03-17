# Analytics Security & Privacy Policy

## Data Collection
We collect the minimum data necessary to provide analytics:
- **Email Open**: IP Address (for approximate location), User Agent, Timestamp.
- **Link Click**: Target URL, User Agent, IP Address.
- **Page View**: Page Path, Time Spent.

## Data Retention
- Raw event data in `analytics_events` is retained for **1 year**.
- Aggregated data (daily summaries) is retained indefinitely.
- We recommend setting up a scheduled pg_cron job to delete raw events older than 1 year to manage storage.

## PII Handling
- **IP Addresses**: Stored in metadata. Should be treated as PII. Access is restricted to Admins.
- **User IDs**: Internal IDs are used. No names or emails are stored directly in event tables.

## Access Control (RLS)
Row Level Security is enforced:
1. **Admins**: Can view all analytics data (`analytics_admin_all` policy).
2. **Users**: Can only view their own interactions (if needed for features like "History").
3. **Public**: Insert-only access via Edge Functions (Service Role) or authenticated client.

## Security Best Practices
- **JWT Verification**: All tracking pixels/links require a valid signed JWT to prevent spoofing.
- **Deduplication**: We implement 10-second deduplication to prevent replay attacks or accidental double-counts.
