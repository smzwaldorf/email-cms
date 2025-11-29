# Authentication API Endpoints Reference (T088)

**Phase**: 11 - Documentation & Delivery
**Updated**: 2025-11-29
**Branch**: `003-passwordless-auth`

---

## API Overview

The Email CMS authentication system provides passwordless login through Google OAuth and Magic Links. All endpoints are managed by Supabase Auth and return standard HTTP status codes.

### Base URL
```
https://<your-supabase-url>.supabase.co
```

### Authentication
All authenticated requests require:
```
Authorization: Bearer <access_token>
```

---

## Authentication Endpoints

### 1. Sign In with Email/Password

**Endpoint:**
```
POST /auth/v1/token?grant_type=password
```

**Description:** Sign in with email and password credentials

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "secure_password_123"
}
```

**Success Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "refresh_token_value",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "email_confirmed_at": "2025-11-29T00:00:00Z",
    "user_metadata": {},
    "created_at": "2025-11-29T00:00:00Z"
  }
}
```

**Error Response (401):**
```json
{
  "error": "invalid_grant",
  "error_description": "Invalid Credentials. Ensure the user exists and the password is correct."
}
```

**curl Example:**
```bash
curl -X POST 'https://xxxxxxxxxxxx.supabase.co/auth/v1/token?grant_type=password' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "user@example.com",
    "password": "secure_password_123"
  }'
```

**JavaScript Example:**
```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure_password_123'
});

if (error) {
  console.error('Login failed:', error.message);
} else {
  console.log('User:', data.user);
}
```

---

### 2. Send Magic Link

**Endpoint:**
```
POST /auth/v1/otp
```

**Description:** Send passwordless magic link to email address

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "data": {},
  "create_user": true
}
```

**Success Response (200):**
```json
{
  "id": "session-uuid",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com"
  }
}
```

**Error Response (400):**
```json
{
  "error": "invalid_request",
  "error_description": "Email must be provided"
}
```

**Rate Limiting:**
- **Limit**: 5 magic links per email address per hour
- **Error Response (429)**:
```json
{
  "error": "rate_limit_exceeded",
  "error_description": "Too many magic link requests"
}
```

**curl Example:**
```bash
curl -X POST 'https://xxxxxxxxxxxx.supabase.co/auth/v1/otp' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "user@example.com",
    "create_user": true
  }'
```

**JavaScript Example:**
```javascript
const { data, error } = await supabase.auth.signInWithOtp({
  email: 'user@example.com',
  options: {
    emailRedirectTo: 'http://localhost:5173/auth/callback'
  }
});

if (error) {
  console.error('Magic link error:', error.message);
} else {
  console.log('Check email for magic link');
}
```

---

### 3. Verify Magic Link / OTP

**Endpoint:**
```
POST /auth/v1/verify
```

**Description:** Verify magic link token and create session

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "token_hash": "token_from_email_link",
  "type": "email"
}
```

**Success Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "refresh_token_value",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "email_confirmed_at": "2025-11-29T00:00:00Z",
    "created_at": "2025-11-29T00:00:00Z"
  }
}
```

**Error Response (400):**
```json
{
  "error": "invalid_token",
  "error_description": "Token has expired or is invalid"
}
```

**Token Validity:**
- **Duration**: 15 minutes
- **One-time use**: Token can only be used once

**curl Example:**
```bash
curl -X POST 'https://xxxxxxxxxxxx.supabase.co/auth/v1/verify' \
  -H 'Content-Type: application/json' \
  -d '{
    "token_hash": "token_from_link",
    "type": "email"
  }'
```

**JavaScript Example:**
```javascript
const { data, error } = await supabase.auth.verifyOtp({
  token_hash: tokenFromUrl,
  type: 'email'
});

if (error) {
  console.error('Verification failed:', error.message);
} else {
  console.log('Logged in as:', data.user.email);
}
```

---

### 4. Sign In with Google OAuth

**Endpoint:**
```
POST /auth/v1/oauth
```

**Description:** Initiate Google OAuth login flow

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "provider": "google",
  "options": {
    "redirectTo": "http://localhost:5173/auth/callback"
  }
}
```

**Response:**
User will be redirected to Google login page. After authorization, Supabase redirects back to your callback URL with session tokens in URL fragment.

**curl Example:**
```bash
# OAuth flow requires interactive browser, not suitable for curl
# Use SDK example below instead
```

**JavaScript Example:**
```javascript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'http://localhost:5173/auth/callback'
  }
});

if (error) {
  console.error('OAuth error:', error.message);
}
// User will be redirected to Google, then back to your callback URL
```

**OAuth Flow:**
1. User clicks "Login with Google"
2. Redirected to Google login
3. User authorizes application
4. Redirected to callback URL with tokens in fragment
5. Application extracts tokens and creates session

---

### 5. Get Current Session

**Endpoint:**
```
GET /auth/v1/user
```

**Description:** Get the currently authenticated user

**Request Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Success Response (200):**
```json
{
  "id": "user-uuid",
  "aud": "authenticated",
  "email": "user@example.com",
  "email_confirmed_at": "2025-11-29T00:00:00Z",
  "phone": "",
  "phone_confirmed_at": null,
  "confirmed_at": "2025-11-29T00:00:00Z",
  "last_sign_in_at": "2025-11-29T12:00:00Z",
  "app_metadata": {
    "provider": "google"
  },
  "user_metadata": {},
  "identities": [
    {
      "id": "user-uuid",
      "user_id": "user-uuid",
      "identity_data": {
        "email": "user@example.com",
        "email_verified": true,
        "phone_verified": false,
        "sub": "google-oauth-id"
      },
      "provider": "google",
      "created_at": "2025-11-29T00:00:00Z",
      "last_sign_in_at": "2025-11-29T00:00:00Z"
    }
  ],
  "created_at": "2025-11-29T00:00:00Z",
  "updated_at": "2025-11-29T12:00:00Z"
}
```

**Error Response (401):**
```json
{
  "error": "Unauthorized",
  "error_description": "JWT expired"
}
```

**curl Example:**
```bash
curl -X GET 'https://xxxxxxxxxxxx.supabase.co/auth/v1/user' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

**JavaScript Example:**
```javascript
const { data: { user }, error } = await supabase.auth.getUser();

if (error) {
  console.error('Not authenticated:', error.message);
} else {
  console.log('Current user:', user.email);
}
```

---

### 6. Refresh Access Token

**Endpoint:**
```
POST /auth/v1/token?grant_type=refresh_token
```

**Description:** Refresh expired access token using refresh token

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "refresh_token": "refresh_token_value"
}
```

**Success Response (200):**
```json
{
  "access_token": "new_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "new_refresh_token_value"
}
```

**Error Response (401):**
```json
{
  "error": "invalid_grant",
  "error_description": "Refresh token has expired"
}
```

**Auto-Refresh:** The application automatically refreshes tokens before expiry (by default, 15 minutes before expiration).

**curl Example:**
```bash
curl -X POST 'https://xxxxxxxxxxxx.supabase.co/auth/v1/token?grant_type=refresh_token' \
  -H 'Content-Type: application/json' \
  -d '{
    "refresh_token": "your_refresh_token"
  }'
```

**JavaScript Example:**
```javascript
const { data, error } = await supabase.auth.refreshSession();

if (error) {
  console.error('Refresh failed:', error.message);
} else {
  console.log('Token refreshed');
}
```

---

### 7. Sign Out

**Endpoint:**
```
POST /auth/v1/logout
```

**Description:** Sign out the current user and invalidate session

**Request Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Success Response (204):**
```
No content
```

**Error Response (401):**
```json
{
  "error": "Unauthorized"
}
```

**curl Example:**
```bash
curl -X POST 'https://xxxxxxxxxxxx.supabase.co/auth/v1/logout' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

**JavaScript Example:**
```javascript
const { error } = await supabase.auth.signOut();

if (error) {
  console.error('Logout failed:', error.message);
} else {
  console.log('Logged out successfully');
}
```

---

## Admin Endpoints

These endpoints require elevated privileges and are typically called from your backend.

### Get User Sessions

**Endpoint:**
```
GET /auth/v1/admin/users/{user_id}/sessions
```

**Description:** Get all active sessions for a user

**Authorization:** Service role key required

**Success Response (200):**
```json
[
  {
    "id": "session-uuid-1",
    "user_id": "user-uuid",
    "created_at": "2025-11-29T10:00:00Z",
    "updated_at": "2025-11-29T12:00:00Z",
    "last_active_at": "2025-11-29T12:00:00Z",
    "user_agent": "Mozilla/5.0..."
  }
]
```

---

## Error Codes Reference

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | User authenticated successfully |
| 204 | No Content | Logout successful |
| 400 | Bad Request | Missing required parameters |
| 401 | Unauthorized | Invalid token or credentials |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Supabase service error |

---

## Rate Limiting

### Magic Link Limits
- **Per Email**: 5 requests per hour
- **Response Code**: 429 (Too Many Requests)

### Password Login Limits
- **Per Email**: Managed by Supabase
- **Prevents**: Brute force attacks

### Response Header
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 2
X-RateLimit-Reset: 1701259200
```

---

## Session Management

### Token Duration
- **Access Token**: 1 hour
- **Refresh Token**: 30 days
- **Auto-Refresh**: 15 minutes before expiry

### Secure Storage
- **Access Token**: Memory (localStorage in browser)
- **Refresh Token**: HttpOnly Cookie (secure, inaccessible to JavaScript)
- **Cross-Tab**: Synced via localStorage events

---

## Event Logging

All authentication events are logged to `auth_events` table:

| Event | Logged When | User ID |
|-------|---|---|
| `magic_link_sent` | Magic link sent | No |
| `magic_link_verified` | Link verified | Yes |
| `login_success` | Password login | Yes |
| `login_failure` | Failed login | No |
| `oauth_google_start` | OAuth initiated | No |
| `logout` | User signs out | Yes |

---

## Code Examples

### Complete Login Flow (JavaScript)

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xxxxxxxxxxxx.supabase.co',
  'your_anon_key'
);

// Option 1: Magic Link Login
async function loginWithMagicLink(email) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin + '/auth/callback'
    }
  });

  if (error) throw error;
  return data;
}

// Option 2: Google OAuth
async function loginWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/auth/callback'
    }
  });

  if (error) throw error;
  return data;
}

// Get Current User
async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) throw error;
  return user;
}

// Logout
async function logout() {
  const { error } = await supabase.auth.signOut();

  if (error) throw error;
}

// Usage
try {
  await loginWithMagicLink('user@example.com');
  console.log('Check your email for the magic link!');
} catch (error) {
  console.error('Login failed:', error.message);
}
```

---

## Testing the API

### Using curl

```bash
# Set variables
SUPABASE_URL="https://xxxxxxxxxxxx.supabase.co"
ANON_KEY="your_anon_key"
EMAIL="test@example.com"

# Send magic link
curl -X POST "${SUPABASE_URL}/auth/v1/otp" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"create_user\":true}"
```

### Using Postman

1. Create new POST request
2. URL: `https://xxxxxxxxxxxx.supabase.co/auth/v1/otp`
3. Headers: `Content-Type: application/json`
4. Body:
```json
{
  "email": "test@example.com",
  "create_user": true
}
```
5. Send

---

## Support & Resources

- **Supabase Auth Docs**: https://supabase.com/docs/guides/auth
- **API Reference**: https://supabase.com/docs/reference/api
- **Examples**: Check `tests/integration/` directory in repository
- **Issues**: Report in GitHub issues with API endpoint label

---

**API Reference Complete** ✅
