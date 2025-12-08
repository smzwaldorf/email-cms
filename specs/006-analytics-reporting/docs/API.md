# Analytics Service API Documentation

## Overview
The Analytics Service provides endpoints for tracking user interactions via email and web. It uses Supabase Edge Functions.

## Endpoints

### 1. Tracking Pixel (Email Open)
Tracks when a user opens a newsletter email. Returns a transparent 1x1 GIF.

**URL**: `GET /functions/v1/tracking-pixel`

**Query Parameters**:
- `t` (Required): JWT Token containing `user_id` and `newsletter_id`.

**Headers**:
- `User-Agent`: Used for device usage analytics.
- `X-Forwarded-For`: Used for approximate location (if enabled).

**Response**:
- **200 OK**: Returns image/gif (1x1 transparent pixel).
- **Error**: Logs error internally but still returns GIF to prevent broken images.

**Example**:
```
<img src="https://[project].supabase.co/functions/v1/tracking-pixel?t=[token]" />
```

### 2. Tracking Redirect (Link Click)
Tracks when a user clicks a link in the newsletter. Redirects the user to the target URL.

**URL**: `GET /functions/v1/tracking-click`

**Query Parameters**:
- `t` (Required): JWT Token.
- `url` (Required): The target URL to redirect to (URL encoded).

**Response**:
- **302 Found**: Redirects to `url`.
- **400 Bad Request**: If `url` is missing.

**Example**:
```
https://[project].supabase.co/functions/v1/tracking-click?t=[token]&url=https%3A%2F%2Fexample.com
```

### 3. Client-Side Tracking
Client-side tracking is handled via `trackingService.ts` which interacts directly with the `analytics_events` table using RLS.

- **Event**: `page_view`
- **Event**: `session_end` (Time spent)

## Database Schema
Refer to `supabase/migrations/*_add_analytics_tables.sql` for schema details.
