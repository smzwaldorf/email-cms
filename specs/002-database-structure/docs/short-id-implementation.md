# Short ID Implementation

## Overview
We implemented unique short URLs for articles (e.g., `/week/2025-W47/ay6ubk`) to facilitate sharing. These URLs redirect to the standard weekly view with the specific article selected.

## Database Changes

### Schema
- **Table**: `public.articles`
- **New Column**: `short_id` (VARCHAR(10), UNIQUE, NOT NULL)
- **Index**: `idx_articles_short_id` for fast lookups.

### Automation
- **Function**: `generate_short_id()` generates a random 6-character string using a base62-like charset.
- **Trigger**: `trigger_set_article_short_id` automatically assigns a unique `short_id` before insertion if one is not provided.

## Frontend Implementation

### Routing
- **Route**: `/week/:weekNumber/:shortId`
- **Component**: `WeeklyReaderPage`

### Redirection Logic
1.  **Detection**: `WeeklyReaderPage` checks for `shortId` in the URL parameters.
2.  **Selection**: It finds the article matching the `shortId` within the fetched weekly articles.
3.  **URL Cleanup**: If found, it selects the article and immediately replaces the URL with the clean `/week/:weekNumber` format using `navigate(..., { replace: true })`.
4.  **Fallback**: If the `shortId` is invalid or the article is not found, it defaults to the first article of the week.

### Persistent Redirection (Login Flow)
To support deep linking for unauthenticated users:
1.  **Capture**: If an unauthenticated user visits a short URL, `ProtectedRoute` captures the `shortId` and `weekNumber` and stores them in `localStorage` (`pending_short_id`, `pending_week_number`).
2.  **Login**: The user is redirected to `/login`.
3.  **Restore**: After successful login, `WeeklyReaderPage` checks `localStorage`. If a pending short ID exists and matches the current week, it redirects to that article.
4.  **Cleanup**: The `localStorage` keys are cleared immediately after the redirection attempt.

### Security & State Management
- **Cache Clearing**: To prevent state leakage between users, `AuthContext` clears the `pending_short_id` and `pending_week_number` keys from `localStorage` upon sign out.
- **Navigation Reset**: `NavigationContext` resets its internal state to defaults when the user logs out.
