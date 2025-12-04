# CORS Configuration Guide

**Date**: 2025-12-04
**Feature**: 004-rich-text-editor
**Phase**: Security Hardening (Medium Priority)
**Estimated Time**: 30 minutes

## Overview

Cross-Origin Resource Sharing (CORS) controls which domains can access your API. Without proper configuration, any website could attempt to access your Supabase APIs on behalf of authenticated users.

## Security Risks

### Without CORS Configuration
- **Cross-Site Request Forgery (CSRF)**: Malicious sites can make requests to your API
- **Unauthorized Data Access**: External sites could access user data if authenticated
- **API Abuse**: Unlimited requests from any origin

### With CORS Configuration
- ✅ Only trusted domains can make requests
- ✅ Browsers enforce origin validation
- ✅ Significantly reduces attack surface

## Current Application

**Domain**: Your deployed domain (e.g., `https://newsletter.example.com`)
**Current Environment**: Development (localhost:5173)

## Implementation

### Option 1: Supabase Dashboard (Quick Setup)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Settings** → **API**
4. Find **CORS Configuration** section
5. Add allowed origins:

```
http://localhost:5173        (Development)
https://newsletter.example.com  (Production)
```

### Option 2: Environment Configuration (Recommended)

Create `supabase/config.json` with CORS settings:

```json
{
  "api": {
    "max_body_size": "20mb",
    "cors": {
      "enabled": true,
      "allow_credentials": true,
      "allowed_headers": [
        "Content-Type",
        "Authorization",
        "X-CSRF-Token",
        "X-Requested-With"
      ],
      "allowed_methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      "allowed_origins": [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://newsletter.example.com",
        "https://*.newsletter.example.com"
      ],
      "expose_headers": [
        "Content-Length",
        "X-JSON-Response-Consumed"
      ],
      "max_age": 3600
    }
  }
}
```

### Option 3: Vite Environment Variables (For Frontend)

Create `.env.development` and `.env.production`:

**.env.development**:
```bash
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-dev-key
VITE_API_ORIGIN=http://localhost:5173
```

**.env.production**:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-prod-key
VITE_API_ORIGIN=https://newsletter.example.com
```

Use in client initialization:

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const apiOrigin = import.meta.env.VITE_API_ORIGIN

export const supabaseClient = createClient(supabaseUrl, supabaseKey)
```

## Verification

### Test CORS Configuration

1. **Development Testing**:
```bash
npm run dev
# Navigate to http://localhost:5173
# Check browser console for CORS errors (should be none)
```

2. **Production Testing**:
```bash
# Test from allowed origin
curl -H "Origin: https://newsletter.example.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  --head https://your-project.supabase.co/rest/v1/articles
```

3. **Browser DevTools**:
   - Open Network tab
   - Check response headers:
     - `Access-Control-Allow-Origin: https://allowed-domain.com`
     - `Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`
     - `Access-Control-Allow-Headers: Content-Type, Authorization`

### Expected Response Headers

```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token
Access-Control-Max-Age: 3600
```

## Common Issues

### Issue: CORS Error in Browser
```
Access to XMLHttpRequest has been blocked by CORS policy
```

**Solution**:
1. Check the origin in browser DevTools (Network tab → request → Headers)
2. Verify origin is in Supabase CORS allowlist
3. Ensure exact protocol (http:// vs https://)
4. Check domain matches (trailing slash, www prefix)

### Issue: Credentials Not Sent
```
Request header field Authorization is not allowed
```

**Solution**:
```typescript
// Ensure credentials are sent with requests
const response = await fetch(apiUrl, {
  method: 'GET',
  credentials: 'include',  // Send cookies/auth
  headers: {
    'Content-Type': 'application/json',
  },
})
```

### Issue: Preflight Request Failing
```
Access-Control-Request-Headers value is not allowed
```

**Solution**:
Add all custom headers to CORS configuration:
```json
"allowed_headers": [
  "Content-Type",
  "Authorization",
  "X-CSRF-Token",
  "X-Requested-With",
  "Accept"
]
```

## Advanced Configuration

### Subdomain Wildcards
```json
"allowed_origins": [
  "https://*.newsletter.example.com",  // Matches all subdomains
  "https://newsletter.example.com"     // Exact domain
]
```

### Development Exceptions
For local development with multiple ports:
```json
"allowed_origins": [
  "http://localhost:3000",   // React dev server
  "http://localhost:5173",   // Vite dev server
  "http://127.0.0.1:5173",   // Alternative localhost
  "https://dev.newsletter.example.com"
]
```

### Staging Environment
```json
"allowed_origins": [
  "https://staging-newsletter.example.com",
  "https://newsletter-staging.example.com"
]
```

## Security Best Practices

### ✅ DO
- Use `https://` for production domains
- Be specific: use exact domains, not `*`
- Keep allowlist minimal
- Review regularly for stale entries
- Use subdomain wildcards carefully
- Log CORS rejections for monitoring

### ❌ DON'T
- Allow `*` (all origins) in production
- Mix http and https
- Allow localhost in production
- Trust frontend-only CORS (server-side validate too)
- Forget to update when domain changes

## Integration with Other Security Measures

### With Rate Limiting
CORS + Rate Limiting provides defense-in-depth:
- CORS: Prevents unauthorized origins (network layer)
- Rate Limiting: Prevents abuse from authorized origins (application layer)

### With CSRF Protection
CORS + CSRF Protection:
- CORS: Restricts request origin
- CSRF: Validates request legitimacy via tokens

### With Authentication
CORS + Authentication:
- CORS: Restricts origin
- Auth: Validates user identity
- Both required for complete protection

## Deployment Checklist

- [ ] Identified all production domains
- [ ] Identified all development/staging domains
- [ ] Updated Supabase CORS settings
- [ ] Tested from each allowed domain
- [ ] Verified credentials are included
- [ ] Checked browser console for CORS errors
- [ ] Tested preflight requests (OPTIONS)
- [ ] Set up monitoring for CORS rejections
- [ ] Documented allowed origins in team wiki
- [ ] Reviewed quarterly for stale domains

## Monitoring

### Log CORS Rejections
Monitor Supabase logs for CORS rejections:

```bash
# Via Supabase CLI
supabase logs --project-ref <project-id> --filter="cors"
```

### Set Up Alerts
Create alert for high CORS rejection rate:
- Threshold: >10 rejections per minute
- Action: Notify security team

## References

- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Supabase: CORS Configuration](https://supabase.com/docs/guides/api/cors)
- [OWASP: Cross-Origin Resource Sharing](https://owasp.org/www-community/Cross-Origin_Resource_Sharing_(CORS))
- [Spring Security: CORS](https://spring.io/guides/gs/cors-rest/)

## Related Security Items

This is part of the **Medium Priority Security Hardening**:
1. ✅ **Rate Limiting** (CRITICAL - COMPLETED)
2. ✅ **Storage Quotas** (CRITICAL - COMPLETED)
3. ✅ **Dependency Updates** (CRITICAL - COMPLETED)
4. 🔄 **CORS Configuration** (THIS ITEM)
5. ⏳ **CSRF Protection** (PLANNED)
6. ⏳ **CSP Headers** (PLANNED)
