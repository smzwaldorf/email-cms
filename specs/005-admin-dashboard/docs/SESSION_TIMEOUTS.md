# Session Timeout & Refresh Mechanisms

**Last Updated:** 2025-12-07
**Context:** Investigation into why users may need to refresh the page to maintain access or view content.

This document summarizes the distinct mechanisms that can cause a session timeout or force a page refresh, categorized by whether they are actual authentication expirations, artificial UI limitations, or constraints imposed by Supabase.

## 1. Artificial UI Timeouts (Frontend)
These are "false positives" where the user is likely still logged in, but the frontend blocks them because data didn't load fast enough.

| Component | Duration | Mechanism | User Experience |
| :--- | :--- | :--- | :--- |
| **Protected Route** | **5 Seconds** | `src/components/ProtectedRoute.tsx` starts a timer on mount. If auth check isn't confirmed by then, it assumes failure. | Shows "Connection Timeout" screen with a **"Refresh Page"** button. |
| **Article Loading** | **3 Seconds** | `src/pages/WeeklyReaderPage.tsx` uses `useLoadingTimeout`. If fetch takes >3s, it aborts wait. | Shows error state, effectively forcing a reload/retry. |

**Trigger:** Slow network, large data payload, or initial "cold start" latency from Supabase.

## 2. Token Refresh Failures ("The Stuck State")
This is the most common cause of "needing a refresh to fix it" while browsing.

*   **Mechanism:** `src/services/tokenManager.ts` stores the **Access Token** in JavaScript memory (not LocalStorage) for security.
*   **The Failure:** The manager tries to "silently" refresh this token via a background network request.
    *   If the request times out (>15s limit in `tokenManager`).
    *   If the network connection blips during the request.
*   **Result:** The in-memory token is cleared/invalidated. The app behaves as if logged out.
*   **Why Refresh Fixes It:** A page reload re-initializes the Supabase SDK, which reads the valid, long-lived **Refresh Token** (30-day validity) from `localStorage` and requests a brand new Access Token.

## 3. Actual Authentication Expiry
These are hard limits where the session is genuinely invalid.

| Type | Duration | Description | Solved by Refresh? |
| :--- | :--- | :--- | :--- |
| **Access Token** | **1 Hour** | The JWT used for API requests expires. | **Yes** (via Auto-Refresh logic). |
| **Refresh Token** | **30 Days** | The "Remember Me" session duration. | **No**. User is redirected to Login. |
| **Force Logout** | **Immediate** | Admin invokes `delete_user_sessions` RPC. | **No**. Next request triggers 401. |

## 4. Supabase Impositions (`config.toml`)
Hard rules enforced by the Supabase backend and SDK.

### A. Hard Time Limits
*   **Access Token Life (3600s):** The JWT is valid for exactly 1 hour. The client *must* refresh it before this window closes.
*   **Refresh Token Rotation (`enable_refresh_token_rotation = true`):**
    *   Every refresh invalidates the *old* refresh token and issues a *new* one.
    *   **Risk:** If the client successfully requests a refresh but the network drops before receiving the *new* token, the client holds a now-invalid *old* token. The next attempt will fail, logging the user out.
*   **Reuse Interval (10s):** A 10-second grace period where an old refresh token can be reused (prevents race conditions if multiple tabs refresh simultaneously).

### B. Rate Limiting
*   **Per IP Limit:** `token_refresh = 150` per 5 minutes.
*   **Consequence:** A bug causing a tight loop of refresh attempts will get the user's IP blocked by Supabase for 5 minutes.

### C. Client SDK Behavior
*   **Persistence (`persistSession: true`):** The SDK writes the session to `localStorage`. This is the *only* reason a page refresh restores the session (by reading from disk) when the in-memory state is corrupted.

---

## 5. Ideal UX: "The Gmail Model"

Absolutely — this is a great moment to think from the user’s perspective, and you’re aiming for exactly the kind of smooth, friction-free experience people expect today. Let’s explore some UX concepts and architectural ideas you can borrow from apps like Gmail so your reading experience feels effortless.

### 🌤️ Goal: “I log in once, and everything just works.”

For your readers, the ideal flow feels like this:
*   Login once
*   Read long articles without worrying about timers
*   Leave the browser open for hours
*   Come back and continue instantly
*   Navigate to next articles smoothly
*   Only get logged out if the admin forces it

This is exactly the mental model Gmail, YouTube, and Twitter rely on — quiet water under the bridge, where session refresh happens invisibly while the UI feels permanent.

### 🔥 UX Principles You Can Borrow from Gmail

**1. Sessions should feel “persistent until revoked”**
Users don’t think about session expiry. They think: “I logged in. I should stay logged in.” Unless they manually log out, get logged out centrally (admin revocation), or change passwords. So the safest pattern is long-lived refresh tokens and silent refreshes with zero user-facing interruptions.

**2. Content never disappears**
Imagine someone spending 30 minutes reading. They take a call, step away, return — the article should be exactly where they left it.
*   No sudden bounce to login page
*   No blocking modal
*   No navigation reset
The browser tab remains “trusted”.

**3. Navigation should not trigger re-auth**
If they scroll down and click “Next article”, they expect:
*   Instant transition
*   No auth prompts
*   No flicker
*   No 401 error
*   No need to refresh
This means your frontend must always have a valid access token ready.

**4. Errors should degrade gracefully**
If refresh ever fails:
*   Don’t instantly boot them
*   Show a polite “Re-authenticate?” inline prompt
*   Preserve their scroll position
*   Preserve their place in reading
This reduces frustration dramatically.

### 🌱 How your architecture can support this UX

Here’s how to make your app behave like Gmail while using Supabase.

**1. Keep refresh tokens valid for a very long time**
Set refresh token lifetime to something like 90–180 days for normal reading apps. You can always revoke them from an admin dashboard, when users change passwords, or if suspicious activity is detected. This gives Gmail-like “I never log out unless something happens” behavior.

**2. Supabase auto-refresh should stay alive as long as the tab is alive**
Ensure:
*   You create the client once at startup
*   `autoRefreshToken: true`
*   `persistSession: true`
This gives continuous silent refresh.

**3. Add a gentle heartbeat**
This solves the case where browsers freeze background tasks. For example a small “keep-alive”:
```javascript
setInterval(() => {
  supabase.auth.getSession()
}, 4 * 60 * 1000)
```
This keeps refresh active even during long reads.

**4. Gracefully handle “refresh failed”**
If refresh token becomes invalid (revocation, admin action), you want the UX to be:
1.  User scrolls
2.  Something needs auth
3.  You detect session is invalid
4.  Show a small prompt near the bottom corner: "Your session expired. Click to continue reading."
5.  After login, return them to exactly where they were
6.  Continue reading instantly

**5. Never auto-redirect users to login**
Direct jumps to a login page interrupt reading and create anxiety. Instead: soft prompt, persisted route, persisted scroll position. Readers should feel safe.

**6. Optimize article loading**
To support long, uninterrupted reading: preload the next article, cache the current article locally, restore scroll instantly on reload. This creates the illusion of infinite session continuity.

### 🪄 Example of a “Gmail-like reading session”

**User logs in**
✔️ token saved
✔️ refresh loop running

**Reads a very long article**
✔️ nothing interrupts
✔️ auto refresh happens quietly

**Steps away for 2 hours**
✔️ browser tab may go inactive, but your heartbeat keeps session warm
✔️ Supabase refreshes token in background

**User comes back**
✔️ same scroll position
✔️ page is still alive
✔️ typing “next article” works instantly

**Admin revokes session**
✔️ next page navigation triggers a “Please log in again” popup
✔️ no data loss
✔️ no confusion
✔️ login brings them back to reading instantly