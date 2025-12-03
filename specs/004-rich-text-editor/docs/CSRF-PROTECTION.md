# CSRF Protection Implementation Guide

**Date**: 2025-12-04
**Feature**: 004-rich-text-editor
**Phase**: Security Hardening (Medium Priority)
**Estimated Time**: 1 hour

## Overview

Cross-Site Request Forgery (CSRF) attacks trick authenticated users into making unwanted requests. This guide implements CSRF protection using secure tokens.

## Security Risk

### Without CSRF Protection
```
1. User logs into your application
2. User visits attacker's website (in another tab)
3. Attacker's site makes request to your API:
   POST /api/articles/update
   { "title": "Hacked", "content": "..." }
4. Browser automatically includes user's auth cookie
5. Request succeeds - article is modified!
```

### With CSRF Protection
```
1. User logs into your application
2. Server provides CSRF token
3. User visits attacker's website
4. Attacker's site cannot obtain CSRF token
5. Attacker's request is rejected (missing token)
6. Article is safe
```

## Implementation

### 1. Service Layer (`src/services/csrfProtection.ts`)

**Core Components**:

```typescript
// Generate secure token
const token = csrfProtection.generateToken()
// Returns: 64-character hex string (32 random bytes)

// Validate token from request
const result = csrfProtection.validateToken(tokenFromRequest)
// Returns: { valid: boolean, message: string }

// Extract token from headers
const token = extractCSRFToken(headers)

// Create CSRF-protected headers
const headers = createCSRFHeaders(token)
// Returns: { 'X-CSRF-Token': token, 'Content-Type': 'application/json' }
```

**Features**:
- ✅ Cryptographically secure token generation
- ✅ One-time token usage (prevent replay attacks)
- ✅ 24-hour expiration
- ✅ Automatic cleanup of expired tokens
- ✅ Token statistics for monitoring

### 2. Component Integration (Example)

**Initial Page Load** (generate token):

```typescript
import { csrfProtection } from '@/services/csrfProtection'

function ArticleEditor() {
  const [csrfToken, setCSRFToken] = useState<string>('')

  useEffect(() => {
    // Generate CSRF token on component mount
    const token = csrfProtection.generateToken()
    setCSRFToken(token)
  }, [])

  return (
    <form>
      <input type="hidden" name="csrf_token" value={csrfToken} />
      {/* Form fields */}
    </form>
  )
}
```

**Form Submission** (validate token):

```typescript
import { csrfProtection, createCSRFHeaders } from '@/services/csrfProtection'

async function handleUpdateArticle(formData: any) {
  try {
    const csrfToken = formData.csrf_token

    // Validate token before making request
    const validation = csrfProtection.validateToken(csrfToken)
    if (!validation.valid) {
      throw new Error(validation.message)
    }

    // Use token in request headers
    const headers = createCSRFHeaders(csrfToken)

    const response = await fetch('/api/articles/update', {
      method: 'POST',
      headers,
      body: JSON.stringify(formData),
    })

    if (!response.ok) {
      throw new Error(`Update failed: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('CSRF validation error:', error)
    throw error
  }
}
```

### 3. API Integration (Backend/Supabase Functions)

**Validation in Supabase Function**:

```typescript
// supabase/functions/update-article/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Methods': 'POST' } })
  }

  try {
    const csrfToken = req.headers.get('x-csrf-token')

    // Validate CSRF token
    if (!csrfToken) {
      return new Response(JSON.stringify({ error: 'Missing CSRF token' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Process request
    const body = await req.json()

    // Update article in database
    const { data, error } = await supabase
      .from('articles')
      .update(body)
      .eq('id', body.article_id)

    if (error) throw error

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
```

## Token Lifecycle

### Generation
```
1. User loads page/form
2. Component calls csrfProtection.generateToken()
3. Token stored in memory (server-side)
4. Token sent to client (hidden form field or state)
5. Token expires after 24 hours
```

### Validation
```
1. User submits form
2. Client includes token in request headers
3. Client validates token locally
4. Server/API validates token again
5. If valid: request processed, token marked as "used"
6. If invalid: request rejected with 403 Forbidden
```

### Cleanup
```
- Expired tokens: Auto-deleted after 24 hours
- Used tokens: Kept for logging (optional), deleted on cleanup
- Active tokens: Kept in memory map
```

## Security Best Practices

### ✅ DO
- Generate new token for each page load
- Validate token on every state-changing request (POST, PUT, DELETE)
- Use HTTPS to prevent token interception
- Include token in request header (not query string)
- Combine with authentication (token doesn't replace auth)
- Log CSRF rejections for monitoring
- Rotate tokens periodically
- Use secure random generation (crypto.getRandomValues)

### ❌ DON'T
- Reuse same token across requests
- Put token in query string (logged in browser history)
- Trust token alone (always require authentication)
- Accept GET requests for state-changing operations
- Share token across domains
- Store in LocalStorage (vulnerable to XSS)
- Forget to validate on backend

## Defense-in-Depth

CSRF protection works best combined with other security measures:

```
1. CORS (Network Layer)
   └─ Restrict allowed origins

2. Authentication (User Layer)
   └─ Verify user identity

3. CSRF Token (Request Layer)
   └─ Verify request legitimacy

4. Rate Limiting (Behavior Layer)
   └─ Limit suspicious patterns

5. Input Validation (Data Layer)
   └─ Sanitize/validate all inputs
```

## Testing

### Unit Tests
14 comprehensive test cases in `tests/unit/services/csrfProtection.test.ts`:

- ✅ Token generation and validity
- ✅ One-time token usage
- ✅ Token expiration
- ✅ Invalid/expired token handling
- ✅ Header extraction
- ✅ Token statistics
- ✅ Cleanup mechanics

All tests passing ✅

### Integration Testing

Test CSRF protection in real scenarios:

```typescript
// Example: Test form submission with CSRF
it('should reject request without CSRF token', async () => {
  const response = await fetch('/api/articles/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Updated' }),
  })

  expect(response.status).toBe(403)
})

it('should accept request with valid CSRF token', async () => {
  const token = csrfProtection.generateToken()

  const response = await fetch('/api/articles/update', {
    method: 'POST',
    headers: { 'X-CSRF-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Updated' }),
  })

  expect(response.status).toBe(200)
})

it('should reject reused CSRF token', async () => {
  const token = csrfProtection.generateToken()

  // First use: should succeed
  await fetch('/api/articles/update', {
    method: 'POST',
    headers: { 'X-CSRF-Token': token },
    body: JSON.stringify({ title: 'Updated' }),
  })

  // Second use: should fail (token already used)
  const response = await fetch('/api/articles/update', {
    method: 'POST',
    headers: { 'X-CSRF-Token': token },
    body: JSON.stringify({ title: 'Updated Again' }),
  })

  expect(response.status).toBe(403)
})
```

## Monitoring

### Token Statistics
```typescript
const stats = csrfProtection.getTokenStats()
// Returns: { total, valid, expired, used }

console.log(`Active CSRF tokens: ${stats.valid}`)
console.log(`Expired tokens: ${stats.expired}`)
console.log(`Used tokens: ${stats.used}`)
```

### Logging CSRF Rejections
```typescript
// Log whenever validation fails
const result = csrfProtection.validateToken(token)
if (!result.valid) {
  console.warn(`CSRF rejection: ${result.message}`)
  // Alert: could indicate attack
}
```

### Metrics to Monitor
- **High CSRF rejection rate**: Possible attack
- **High token generation rate**: Possible DoS
- **Expired tokens**: Might need longer TTL
- **Token expiration pattern**: Usage patterns

## Deployment

### 1. Add CSRF Protection to API Routes
```typescript
// src/pages/api/articles/update.ts
export async function POST(req: Request) {
  const csrfToken = req.headers.get('x-csrf-token')

  if (!csrfToken) {
    return new Response(JSON.stringify({ error: 'CSRF token required' }), {
      status: 403,
    })
  }

  const validation = csrfProtection.validateToken(csrfToken)
  if (!validation.valid) {
    return new Response(JSON.stringify({ error: validation.message }), {
      status: 403,
    })
  }

  // Process request...
}
```

### 2. Update Components
```typescript
// Generate token on component mount
useEffect(() => {
  const token = csrfProtection.generateToken()
  setCSRFToken(token)
}, [])

// Include token in all state-changing requests
```

### 3. Test Coverage
```bash
npm test -- csrfProtection.test.ts  # Unit tests
npm test -- integration/csrf.test.ts # Integration tests
npm run test:ui                       # Visual test interface
```

## Configuration

### Token Length
```typescript
// Current: 32 bytes = 256-bit token
TOKEN_LENGTH: 32  // ✅ Recommended

// For higher security (if needed):
TOKEN_LENGTH: 64  // 512-bit token
```

### Token Expiry
```typescript
// Current: 24 hours
TOKEN_EXPIRY: 24 * 60 * 60 * 1000

// For shorter-lived tokens:
TOKEN_EXPIRY: 1 * 60 * 60 * 1000    // 1 hour

// For longer-lived tokens:
TOKEN_EXPIRY: 7 * 24 * 60 * 60 * 1000  // 7 days
```

## Troubleshooting

### Issue: "CSRF token not provided"
```
Error: CSRF token not provided
```

**Solution**:
1. Ensure token is generated on page load
2. Verify token is included in request headers
3. Check header name matches: `X-CSRF-Token`

### Issue: "CSRF token has been used"
```
Error: CSRF token has been used
```

**Solution**:
1. Each request needs a fresh token
2. Generate new token after each request
3. Don't reuse tokens across requests

### Issue: "CSRF token has expired"
```
Error: CSRF token has expired
```

**Solution**:
1. Increase TOKEN_EXPIRY if users need longer sessions
2. Regenerate token before expiration
3. Implement token refresh endpoint

## References

- [OWASP: Cross-Site Request Forgery (CSRF)](https://owasp.org/www-community/attacks/csrf)
- [MDN: Cross-Site Request Forgery (CSRF)](https://developer.mozilla.org/en-US/docs/Glossary/CSRF)
- [CWE-352: Cross-Site Request Forgery](https://cwe.mitre.org/data/definitions/352.html)

## Related Security Items

This is part of the **Medium Priority Security Hardening**:
1. ✅ **Rate Limiting** (CRITICAL - COMPLETED)
2. ✅ **Storage Quotas** (CRITICAL - COMPLETED)
3. ✅ **Dependency Updates** (CRITICAL - COMPLETED)
4. ✅ **CORS Configuration** (COMPLETED)
5. 🔄 **CSRF Protection** (THIS ITEM)
6. ⏳ **CSP Headers** (PLANNED)
