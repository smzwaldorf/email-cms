# Analytics Strategy & Implementation Plan

**Date**: 2025-12-05
**Related Specs**: `FUTURE-PLANS-DETAILS.md`

## 1. The Challenge: Bridging Email & Web

The user journey spans two disconnected environments:
1.  **Email Client** (Gmail, Outlook, etc.) - *Static, restricted environment.*
2.  **CMS Web App** (Browser) - *Dynamic, interactive environment.*

To track the full journey ("Did User X read the newsletter?"), we must carry the user's identity from the email to the web app.

### The Solution: "Smart Links" with Identity Tokens
Every link in the email must contain a unique, secure token.
- **Format**: `https://cms.com/article/123?t=SECURE_TOKEN`
- **Payload**: The token maps to `{ userId, newsletterId, classId }`.
- **Security**: The token should be time-limited or signed (JWT) to prevent spoofing, but allow "Magic Link" style access (no login required for reading).

---

## 2. Requirement Analysis & Tool Selection

We have 4 specific metrics to track. Here is how different tools stack up:

| Metric | Requirement | Hotjar | Custom (Supabase) | PostHog | Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Timeliness** | "Read within a few days" | 🔴 No (No access to sent_at) | 🟢 **Yes** (Compare `visit_time` vs `sent_at`) | 🟢 Yes | **Custom** |
| **2. Coverage** | "Which articles read" | 🟡 Hard (Qualitative only) | 🟢 **Yes** (Precise logs) | 🟢 Yes | **Custom** |
| **3. Duration** | "How long spent" | 🟢 Yes (Session recording) | 🟡 Medium (Needs heartbeat logic) | 🟢 Yes | **PostHog** or **Custom** |
| **4. Interest** | "Which area (Heatmap)" | 🟢 **Excellent** | 🔴 No (Too hard to build) | 🟢 Good | **Hotjar** |

### Why Hotjar is not enough
Hotjar is a **Qualitative** tool. It answers *"Why are users leaving?"* or *"Are they confused?"*.
It is **NOT** a **Quantitative** tool. It cannot easily answer *"List all parents who read the newsletter this week"* or *"Show me the read rate for Class A vs Class B"*.

Since your `FUTURE-PLANS-DETAILS.md` (US-CMS-012) requires an **Admin Dashboard** with these stats, you **cannot** rely on Hotjar alone. You need the data in your database to query and display it.

---

## 3. Proposed Hybrid Architecture

We recommend a **Hybrid Approach**:
1.  **Custom Tracking (Supabase)**: For Business Metrics (Who, When, What). This powers your Admin Dashboard.
2.  **Hotjar (Free Tier)**: For UX Insights (Heatmaps, Recordings). This is for manual review by the team.

### A. Custom Tracking Implementation (The "Must-Haves")

#### 1. Database Schema
We need a table to store the raw events.

```sql
create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  newsletter_id uuid references newsletters(id),
  article_id uuid references articles(id), -- Nullable (if just viewing the index)
  event_type text not null, -- 'page_view', 'scroll_50', 'scroll_90'
  metadata jsonb, -- { "duration_seconds": 30, "source": "email_link" }
  created_at timestamptz default now()
);
```

#### 2. The "Smart Link" Flow
1.  **Email Generation**: When generating the newsletter HTML, append `?ref_token=JWT` to all links.
2.  **Frontend Entry**:
    - User clicks link -> Lands on CMS.
    - `useEffect` detects `ref_token`.
    - Decodes token to identify User & Newsletter.
    - Fires `session_start` event to Supabase.

#### 3. Tracking Logic
- **Timeliness**: `analytics_events.created_at` - `newsletter.published_at`.
- **Coverage**: Count unique `article_id` in `analytics_events` where `event_type = 'page_view'`.
- **Duration**:
    - Simple: `page_leave_time` - `page_enter_time`.
    - Robust: Send a "heartbeat" every 10 seconds. Duration = `count(heartbeats) * 10`.

### B. Hotjar Integration (The "Nice-to-Haves")

Simply add the Hotjar script to `index.html`.
- **Heatmaps**: Enable on Article pages. You will see exactly where people stop scrolling.
- **Recordings**: Watch individual sessions to see navigation patterns.

### C. Kit.com (ConvertKit) Implementation Details

Since you are using **Kit.com**, you cannot generate unique tokens *during* the email send process (Kit doesn't support dynamic custom code per email). You must **pre-sync** identity tokens to Kit.

#### 1. The "Magic Token" Strategy
Instead of a short-lived JWT, use a **long-lived, revocable User Token**.

1.  **Create Custom Field in Kit**: Go to Kit Dashboard -> Subscribers -> Custom Fields. Create a field named `cms_ref_token`.
2.  **Sync Token**: When a user is created in your CMS:
    - Generate a secure random string (e.g., `user_xyz123_token`).
    - Store it in your DB: `users.ref_token`.
    - Call Kit API to update the subscriber's `cms_ref_token` field.
3.  **Email Template**:
    - In your Kit email editor, append the Liquid tag to your links:
    - `https://your-cms.com/article/123?ref={{ subscriber.cms_ref_token }}`

#### 2. Security Note
- **Risk**: If a user forwards their email, the recipient logs in as them.
- **Mitigation**:
    - These tokens should be **"Read-Only"** access (allow viewing articles, but NOT changing passwords or editing data).
    - If they try to access Admin areas, force a real login.

---

## 4. Summary of Benefits

| Feature | Implementation | Benefit |
| :--- | :--- | :--- |
| **Read within X days** | **Custom DB Query** | You can send "Reminder Emails" to parents who haven't read it after 3 days. |
| **Which articles read** | **Custom DB Query** | You can see which topics are popular (e.g., "School Bus" vs "Lunch Menu"). |
| **Time spent** | **Custom Heartbeat** | Identify "Skimmers" vs "Deep Readers". |
| **Heatmaps** | **Hotjar** | Optimize layout (e.g., "Nobody sees the footer, let's move the donation button up"). |

## 5. Alternative: PostHog (The "All-in-One")

If you want to avoid building custom tracking logic, you can use **PostHog**.
- **Pros**: Does EVERYTHING (Events, Heatmaps, Recordings, Feature Flags).
- **Cons**:
    - You still need to integrate it into your Admin Dashboard (via API).
    - Data is external (unless you self-host).
    - Might be overkill for a simple newsletter app.

**Verdict**: Stick to **Custom (Supabase) + Hotjar**. It keeps your core data (Who read what) in your own DB, which is essential for your Admin Dashboard requirements.
