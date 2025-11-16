# Authentication & Authorization System

## Overview

This document outlines the authentication and authorization strategy for the Email CMS application, designed with security and user experience in mind for a Waldorf education environment.

### Key Principles

1. **Passwordless Authentication**: No passwords stored - reduces security risks and improves UX
2. **Multiple Auth Methods**: Support Google OAuth and Email Magic Links
3. **Role-Based Authorization**: Permissions based on user roles (Admin, Teacher, Parent, Student)
4. **Secure by Default**: JWT tokens, secure session management, and CSRF protection

---

## 1. Authentication Methods

### 1.1 Google OAuth 2.0

**Use Case**: Primary authentication method for users with Google accounts

**Flow:**
```
1. User clicks "Sign in with Google"
2. Redirect to Google OAuth consent screen
3. User authorizes application
4. Google returns authorization code
5. Exchange code for access token and user info
6. Create or update user record
7. Issue JWT access token and refresh token
8. Return to application
```

**Implementation:**
```typescript
// Google OAuth Configuration
const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
  scope: [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ]
};

// OAuth Flow Handler
async function handleGoogleCallback(authCode: string): Promise<AuthResponse> {
  // 1. Exchange code for tokens
  const tokens = await exchangeCodeForTokens(authCode);

  // 2. Get user info from Google
  const googleUser = await getGoogleUserInfo(tokens.access_token);

  // 3. Find or create user
  let user = await db.users.findByEmail(googleUser.email);

  if (!user) {
    user = await db.users.create({
      email: googleUser.email,
      firstName: googleUser.given_name,
      lastName: googleUser.family_name,
      avatar: googleUser.picture,
      emailVerified: googleUser.email_verified,
      authProvider: 'google',
      authProviderId: googleUser.sub,
      role: determineUserRole(googleUser.email) // See role assignment logic
    });
  }

  // 4. Update auth provider info
  await db.authProviders.upsert({
    userId: user.id,
    provider: 'google',
    providerId: googleUser.sub,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000)
  });

  // 5. Generate JWT tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return { accessToken, refreshToken, user };
}
```

### 1.2 Email Magic Link (Passwordless)

**Use Case**: Alternative authentication for users without Google accounts

**Flow:**
```
1. User enters email address
2. System generates one-time magic link token
3. Email sent with magic link (valid for 15 minutes)
4. User clicks link in email
5. System validates token
6. Create session and issue JWT tokens
7. User is logged in
```

**Implementation:**
```typescript
// Magic Link Request
async function sendMagicLink(email: string): Promise<void> {
  // 1. Validate email format
  if (!isValidEmail(email)) {
    throw new Error('Invalid email format');
  }

  // 2. Check if user exists
  const user = await db.users.findByEmail(email);
  if (!user) {
    // Security: Don't reveal if email exists
    // But log for admin review
    logger.warn(`Magic link requested for non-existent user: ${email}`);
    return; // Still return success to user
  }

  // 3. Generate magic link token
  const token = generateSecureToken(32); // Cryptographically secure random
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // 4. Store token in database
  await db.magicLinkTokens.create({
    userId: user.id,
    token: hashToken(token), // Store hashed version
    expiresAt,
    used: false
  });

  // 5. Generate magic link URL
  const magicLink = `${process.env.APP_URL}/auth/verify?token=${token}`;

  // 6. Send email
  await emailService.send({
    to: email,
    subject: '登入連結 - Email CMS',
    template: 'magic-link',
    data: {
      magicLink,
      expiresInMinutes: 15,
      userAgent: ctx.request.headers['user-agent']
    }
  });
}

// Magic Link Verification
async function verifyMagicLink(token: string): Promise<AuthResponse> {
  // 1. Hash the token
  const hashedToken = hashToken(token);

  // 2. Find token in database
  const magicLinkToken = await db.magicLinkTokens.findOne({
    token: hashedToken,
    used: false,
    expiresAt: { $gte: new Date() }
  });

  if (!magicLinkToken) {
    throw new Error('Invalid or expired magic link');
  }

  // 3. Mark token as used
  await db.magicLinkTokens.update(magicLinkToken.id, { used: true });

  // 4. Get user
  const user = await db.users.findById(magicLinkToken.userId);

  // 5. Mark email as verified
  if (!user.emailVerified) {
    await db.users.update(user.id, { emailVerified: true });
  }

  // 6. Generate JWT tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return { accessToken, refreshToken, user };
}
```

---

## 2. Database Schema

### 2.1 Updated User Table

```sql
-- User table (password removed, auth provider added)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'CLASS_TEACHER', 'PARENT', 'STUDENT')),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  display_name VARCHAR(200),
  avatar TEXT,
  phone_number VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2.2 Auth Provider Table (OAuth)

```sql
-- OAuth provider information
CREATE TABLE auth_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('google')),
  provider_id VARCHAR(255) NOT NULL, -- Google sub/user ID
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_provider_per_user UNIQUE (user_id, provider),
  CONSTRAINT unique_provider_id UNIQUE (provider, provider_id)
);

CREATE INDEX idx_auth_providers_user_id ON auth_providers(user_id);
CREATE INDEX idx_auth_providers_provider ON auth_providers(provider);
```

### 2.3 Magic Link Tokens Table

```sql
-- Email magic link tokens
CREATE TABLE magic_link_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE, -- Hashed token
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_magic_link_tokens_user_id ON magic_link_tokens(user_id);
CREATE INDEX idx_magic_link_tokens_token ON magic_link_tokens(token);
CREATE INDEX idx_magic_link_tokens_expires_at ON magic_link_tokens(expires_at);

-- Automatically clean up expired tokens
CREATE INDEX idx_magic_link_tokens_cleanup ON magic_link_tokens(expires_at, used);
```

### 2.4 Refresh Tokens Table

```sql
-- JWT refresh tokens (for token rotation)
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked BOOLEAN DEFAULT false,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
```

### 2.5 Audit Log Table

```sql
-- Authentication audit log
CREATE TABLE auth_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email VARCHAR(255),
  event_type VARCHAR(50) NOT NULL, -- 'login', 'logout', 'magic_link_sent', 'token_refresh', etc.
  auth_method VARCHAR(50), -- 'google', 'magic_link'
  success BOOLEAN NOT NULL,
  error_message TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_auth_audit_log_user_id ON auth_audit_log(user_id);
CREATE INDEX idx_auth_audit_log_created_at ON auth_audit_log(created_at);
CREATE INDEX idx_auth_audit_log_event_type ON auth_audit_log(event_type);
```

---

## 3. JWT Token Design

### 3.1 Access Token

**Purpose**: Short-lived token for API authentication

**Lifetime**: 15 minutes

**Payload:**
```typescript
interface AccessTokenPayload {
  sub: string;          // User ID
  email: string;        // User email
  role: UserRole;       // User role
  iat: number;          // Issued at (timestamp)
  exp: number;          // Expires at (timestamp)
  type: 'access';       // Token type
}

// Example
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "email": "parent@example.com",
  "role": "PARENT",
  "iat": 1700000000,
  "exp": 1700000900,
  "type": "access"
}
```

### 3.2 Refresh Token

**Purpose**: Long-lived token for obtaining new access tokens

**Lifetime**: 30 days

**Payload:**
```typescript
interface RefreshTokenPayload {
  sub: string;          // User ID
  jti: string;          // Token ID (for revocation)
  iat: number;          // Issued at
  exp: number;          // Expires at
  type: 'refresh';      // Token type
}
```

### 3.3 Token Generation

```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

function generateAccessToken(user: User): string {
  const payload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
    type: 'access'
  };

  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
}

function generateRefreshToken(user: User): string {
  const tokenId = crypto.randomUUID();

  const payload: RefreshTokenPayload = {
    sub: user.id,
    jti: tokenId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
    type: 'refresh'
  };

  const token = jwt.sign(payload, JWT_REFRESH_SECRET, { algorithm: 'HS256' });

  // Store in database for revocation
  db.refreshTokens.create({
    id: tokenId,
    userId: user.id,
    token: hashToken(token),
    expiresAt: new Date(payload.exp * 1000)
  });

  return token;
}
```

---

## 4. Authorization (Permissions)

### 4.1 Role-Based Access Control (RBAC)

Authorization is based on user roles defined in the main user system model.

**Roles:**
- `ADMIN` - Full system access
- `CLASS_TEACHER` - Manage own class, create class articles
- `PARENT` - View children's class content
- `STUDENT` - View own class content

### 4.2 Middleware Implementation

```typescript
// Authentication middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AccessTokenPayload;

    if (payload.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Authorization middleware
function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

// Usage examples
app.get('/api/articles', requireAuth, async (req, res) => {
  // All authenticated users can view articles (filtered by permissions)
});

app.post('/api/articles', requireAuth, requireRole('ADMIN', 'CLASS_TEACHER'), async (req, res) => {
  // Only admins and teachers can create articles
});

app.get('/api/users', requireAuth, requireRole('ADMIN'), async (req, res) => {
  // Only admins can list all users
});
```

---

## 5. API Endpoints

### 5.1 Authentication Endpoints

```typescript
// Google OAuth
POST   /api/auth/google
  Body: { redirectUri: string }
  Returns: { authUrl: string } // Redirect user here

GET    /api/auth/google/callback
  Query: ?code=xxx&state=xxx
  Returns: { accessToken: string, refreshToken: string, user: User }

// Magic Link
POST   /api/auth/magic-link
  Body: { email: string }
  Returns: { success: true, message: 'Check your email' }

GET    /api/auth/verify
  Query: ?token=xxx
  Returns: { accessToken: string, refreshToken: string, user: User }

// Token Management
POST   /api/auth/refresh
  Body: { refreshToken: string }
  Returns: { accessToken: string, refreshToken: string }

POST   /api/auth/logout
  Headers: { Authorization: Bearer <token> }
  Body: { refreshToken: string }
  Returns: { success: boolean }

GET    /api/auth/me
  Headers: { Authorization: Bearer <token> }
  Returns: { user: User }
```

### 5.2 Admin User Creation

```typescript
// Admin creates user account (then sends magic link)
POST   /api/admin/users
  Permissions: ADMIN only
  Body: {
    email: string,
    role: UserRole,
    firstName: string,
    lastName: string,
    sendMagicLink?: boolean  // Auto-send welcome email with magic link
  }
  Returns: { user: User }

// Send magic link to existing user
POST   /api/admin/users/:userId/send-magic-link
  Permissions: ADMIN only
  Returns: { success: boolean }
```

---

## 6. Security Considerations

### 6.1 Token Security

**Storage:**
- **Access Token**: Store in memory (React state/context) - never in localStorage
- **Refresh Token**: Store in httpOnly cookie or secure localStorage with encryption

**Transmission:**
- Always use HTTPS
- Send tokens in Authorization header: `Authorization: Bearer <token>`

**Rotation:**
- Refresh tokens are rotated on each use (old token invalidated)
- Automatic refresh when access token expires

### 6.2 CSRF Protection

```typescript
// CSRF token middleware
function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // For state-changing operations (POST, PUT, DELETE)
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const csrfToken = req.headers['x-csrf-token'];
    const sessionToken = req.cookies['csrf_token'];

    if (!csrfToken || csrfToken !== sessionToken) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
  }

  next();
}
```

### 6.3 Rate Limiting

```typescript
// Rate limit for authentication endpoints
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts, please try again later'
});

app.post('/api/auth/magic-link', authRateLimiter, sendMagicLinkHandler);
app.post('/api/auth/google', authRateLimiter, googleAuthHandler);
```

### 6.4 Email Verification

```typescript
// Require email verification for sensitive operations
function requireEmailVerified(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.emailVerified) {
    return res.status(403).json({
      error: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }
  next();
}

// Usage
app.post('/api/articles', requireAuth, requireEmailVerified, requireRole('CLASS_TEACHER'), createArticle);
```

---

## 7. User Role Assignment

### 7.1 Initial Role Assignment Logic

When a new user signs up, their role is determined by:

**Option 1: Email Domain Matching**
```typescript
function determineUserRole(email: string): UserRole {
  const domain = email.split('@')[1];

  // School staff domains
  if (domain === 'school.edu.tw' || domain === 'waldorf-school.org') {
    // Check if teacher or admin (requires manual verification)
    return 'CLASS_TEACHER'; // Default for school domain
  }

  // Default to PARENT for external emails
  return 'PARENT';
}
```

**Option 2: Admin Pre-Registration (Recommended)**
```typescript
// Admin creates user accounts first with assigned roles
// Users then use magic link or Google to activate account

async function createUserAccount(adminUser: User, userData: CreateUserData): Promise<User> {
  // Verify admin permission
  if (adminUser.role !== 'ADMIN') {
    throw new Error('Only admins can create user accounts');
  }

  const user = await db.users.create({
    email: userData.email,
    role: userData.role, // Admin specifies role
    firstName: userData.firstName,
    lastName: userData.lastName,
    emailVerified: false,
    isActive: true
  });

  // Optionally send welcome email with magic link
  if (userData.sendWelcomeEmail) {
    await sendMagicLink(user.email);
  }

  return user;
}
```

### 7.2 Role Change

```typescript
// Only admins can change user roles
async function changeUserRole(adminUser: User, userId: string, newRole: UserRole): Promise<User> {
  if (adminUser.role !== 'ADMIN') {
    throw new Error('Only admins can change user roles');
  }

  const user = await db.users.update(userId, { role: newRole });

  // Log the role change
  await db.authAuditLog.create({
    userId: userId,
    eventType: 'role_changed',
    success: true,
    metadata: {
      oldRole: user.role,
      newRole: newRole,
      changedBy: adminUser.id
    }
  });

  return user;
}
```

---

## 8. Frontend Integration

### 8.1 React Authentication Context

```typescript
// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (method: 'google' | 'magic-link', data: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  async function initializeAuth() {
    const refreshToken = getRefreshToken(); // From secure storage

    if (refreshToken) {
      try {
        await refreshAccessToken(refreshToken);
      } catch (error) {
        console.error('Failed to refresh token:', error);
        clearAuth();
      }
    }

    setIsLoading(false);
  }

  async function loginWithGoogle() {
    // Redirect to Google OAuth
    const response = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ redirectUri: window.location.origin + '/auth/callback' })
    });

    const { authUrl } = await response.json();
    window.location.href = authUrl;
  }

  async function loginWithMagicLink(email: string) {
    const response = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    if (!response.ok) {
      throw new Error('Failed to send magic link');
    }
  }

  async function logout() {
    const refreshToken = getRefreshToken();

    if (refreshToken && accessToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
      });
    }

    clearAuth();
  }

  function clearAuth() {
    setUser(null);
    setAccessToken(null);
    clearRefreshToken();
  }

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login: async (method, data) => {
      if (method === 'google') {
        await loginWithGoogle();
      } else {
        await loginWithMagicLink(data.email);
      }
    },
    logout,
    refreshToken: () => refreshAccessToken(getRefreshToken()!)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

### 8.2 Login Component

```typescript
// src/components/Login.tsx
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const { login } = useAuth();

  async function handleGoogleLogin() {
    await login('google', {});
  }

  async function handleMagicLinkLogin(e: React.FormEvent) {
    e.preventDefault();
    await login('magic-link', { email });
    setEmailSent(true);
  }

  return (
    <div className="login-container">
      <h1>登入 Email CMS</h1>

      {/* Google OAuth */}
      <button onClick={handleGoogleLogin} className="btn-google">
        <GoogleIcon />
        使用 Google 帳號登入
      </button>

      <div className="divider">或</div>

      {/* Magic Link */}
      {!emailSent ? (
        <form onSubmit={handleMagicLinkLogin}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="輸入您的電子郵件"
            required
          />
          <button type="submit">發送登入連結</button>
        </form>
      ) : (
        <div className="success-message">
          <CheckIcon />
          <p>登入連結已發送至 {email}</p>
          <p className="note">請檢查您的電子郵件並點擊連結登入</p>
        </div>
      )}
    </div>
  );
}
```

---

## 9. Implementation Checklist

### Phase 1: Core Authentication
- [ ] Set up JWT token generation and verification
- [ ] Implement Google OAuth 2.0 flow
- [ ] Create auth database tables
- [ ] Build authentication middleware
- [ ] Add rate limiting

### Phase 2: Magic Link
- [ ] Implement magic link token generation
- [ ] Set up email service integration
- [ ] Create magic link email template
- [ ] Build verification endpoint
- [ ] Add token cleanup cron job

### Phase 3: Frontend
- [ ] Create AuthContext and hooks
- [ ] Build login UI components
- [ ] Implement token refresh logic
- [ ] Add protected route wrapper
- [ ] Handle auth errors gracefully

### Phase 4: Security
- [ ] Add CSRF protection
- [ ] Implement secure token storage
- [ ] Set up HTTPS/SSL
- [ ] Add audit logging
- [ ] Security testing

### Phase 5: Admin Features
- [ ] Build user management UI
- [ ] Add role assignment interface
- [ ] Implement "send magic link" feature
- [ ] Create user invitation flow

---

## 10. Environment Variables

```env
# JWT Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-here

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-domain.com/auth/google/callback

# Application
APP_URL=https://your-domain.com
NODE_ENV=production

# Email Service (e.g., SendGrid, AWS SES)
EMAIL_SERVICE=sendgrid
EMAIL_API_KEY=your-email-api-key
EMAIL_FROM=noreply@your-domain.com
EMAIL_FROM_NAME=Email CMS

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/email_cms
```

---

**Document Version:** 1.0
**Last Updated:** 2025-11-16
**Author:** Claude (AI Assistant)
**Status:** Ready for Implementation
