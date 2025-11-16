# Design: User System & Authentication Model

## Overview

This PR introduces comprehensive design documentation for the Email CMS user system and authentication, specifically tailored for Waldorf education environments. The design supports a family-centric model with role-based access control, ensuring parents can only view content relevant to their children's classes.

## 📄 Documents Added

### 1. **User System Model** (`docs/user-system-model.md`)
Complete data model design for users, families, classes, and permissions.

### 2. **Authentication & Authorization** (`docs/authentication-authorization.md`)
Passwordless authentication system with Google OAuth and email magic links, plus temporary article access for email newsletters.

## ✨ Key Features

### User System Model (v2.2)

#### 1. **Family-Centric Design**
- **Family** entity to group parents and children
- Supports non-student siblings (e.g., younger children not yet enrolled)
- Flexible family structures (single parent, guardians, grandparents, etc.)

```typescript
Family
├── FamilyMember (Parents) → User accounts
└── FamilyMember (Children)
    ├── Students → User accounts
    └── Non-students → Tracked without accounts
```

#### 2. **Chinese Zodiac Class Naming**
- Classes named using 60-year sexagenary cycle (干支)
- Based on year students enter Grade 1
- Examples: "甲辰" (2024), "辛丑甲" (2021-A), "辛丑乙" (2021-B)

#### 3. **Persistent Class Model**
- Classes grow with students year over year
- Same teacher and classmates progress together
- `currentGrade` updates annually, `startYear` remains constant
- Example: "甲辰" class → Grade 1 (2024) → Grade 2 (2025) → Grade 3 (2026)...

#### 4. **Single Class Membership**
- Each student belongs to **ONE class** at any time
- Historical tracking of transfers and changes
- Database enforced: Unique partial index on `(student_id) WHERE status='ACTIVE'`

#### 5. **Role-Based Permissions**
Four user roles with specific permissions:

| Role | Permissions |
|------|------------|
| **ADMIN** | Full system access |
| **CLASS_TEACHER** | Manage own class, create class articles |
| **PARENT** | View children's class content only |
| **STUDENT** | View own class content |

**Key Permission Rule:**
- Parents can only read 班級大小事 (class news) articles from their children's classes
- Enforced at database level (Row-Level Security) and application layer

### Authentication System (v2.0)

#### 1. **Passwordless Authentication** 🔐
**No passwords stored** - eliminates password breach risks

**Two Methods:**

**Google OAuth 2.0** (Primary)
```
User → Google Login → Authorization → Account Created → JWT Tokens → Logged In
```

**Email Magic Links** (Alternative)
```
User → Enter Email → Magic Link Sent → Click Link (15min validity) → JWT Tokens → Logged In
```

#### 2. **Temporary Article Access Links** 📧
Share articles via email with time-limited, one-time tokens

**Workflow:**
```
Newsletter Email → Special Link (/a/{token}) → Token Validation
                                                    ↓
                                    ┌───────────────┴────────────────┐
                                    ↓                                ↓
                            Authenticated User              Non-Authenticated User
                                    ↓                                ↓
                           Check Permissions                 Create Temp Session
                                    ↓                                ↓
                           Redirect to Article              Redirect to Article
                                                         (with "Sign in" prompt)
```

**Features:**
- ✅ Single-use tokens (30-minute validity)
- ✅ Optional email lock (recipient verification)
- ✅ IP address and user agent tracking
- ✅ Automatic cleanup of expired tokens
- ✅ Seamless transition to permanent access

#### 3. **JWT Token Management**
- **Access Tokens**: 15-minute expiration
- **Refresh Tokens**: 30-day expiration with rotation
- **Secure Storage**: httpOnly cookies (recommended)
- **CSRF Protection**: For state-changing operations

## 🗄️ Database Schema

### Core Tables (7 tables)

1. **users** - User accounts (passwordless)
2. **families** - Household information
3. **family_members** - Links people to families
4. **parent_child_relationships** - Parent-child connections
5. **classes** - Persistent class entities (Chinese zodiac names)
6. **class_memberships** - Student enrollments with transfer history
7. **articles** - Content with class-specific filtering

### Authentication Tables (5 tables)

1. **auth_providers** - OAuth provider info (Google)
2. **magic_link_tokens** - Email verification tokens
3. **article_access_tokens** - Temporary article access
4. **temp_article_sessions** - Non-authenticated sessions
5. **refresh_tokens** - JWT refresh token management
6. **auth_audit_log** - Complete authentication audit trail

## 📊 Entity Relationships

```
Family (1) → (N) FamilyMember
                    ↓ (0..1)
                   User
                    ↓ (1:N, but 1 ACTIVE)
             ClassMembership
                    ↓ (N:1)
                  Class
                    ↓ (1:N)
                 Article
```

## 🔒 Security Features

### Authentication Security
- ✅ No passwords stored (zero breach risk)
- ✅ Rate limiting (5 requests per 15 minutes)
- ✅ Token rotation on refresh
- ✅ Audit logging for all auth events
- ✅ CSRF protection
- ✅ Secure token hashing (never plain text)

### Authorization Security
- ✅ Row-Level Security (RLS) policies
- ✅ Application-layer permission checks
- ✅ Backend validation (never trust frontend)
- ✅ Permission-specific audit logging

### Data Privacy
- ✅ Parents see only their children's data
- ✅ Students see only their class data
- ✅ Teachers see only their assigned class
- ✅ Personal information protected

## 🎨 Frontend Integration

Includes complete examples for:
- ✅ React AuthContext provider
- ✅ Login components (Google + Magic Link)
- ✅ Protected routes
- ✅ Permission utility functions
- ✅ Temporary access UI (banners, prompts)
- ✅ Newsletter email templates

## 📡 API Endpoints

### Authentication (8 endpoints)
```typescript
POST /api/auth/google              // Initiate OAuth
GET  /api/auth/google/callback     // OAuth callback
POST /api/auth/magic-link          // Request magic link
GET  /api/auth/verify?token=xxx    // Verify magic link
POST /api/auth/refresh             // Refresh access token
POST /api/auth/logout              // Revoke tokens
GET  /api/auth/me                  // Get current user
```

### Temporary Access (3 endpoints)
```typescript
GET  /a/:token                               // Access via email token
GET  /articles/:id                           // View article (clean URL)
POST /api/articles/:articleId/access-token  // Generate token
```

### User & Family Management (25+ endpoints)
- User CRUD operations
- Family management
- Class management
- Article filtering

## 📝 Documentation Quality

### Comprehensive Coverage
- ✅ TypeScript type definitions
- ✅ Complete SQL schema with constraints
- ✅ Row-Level Security policies
- ✅ Sample data with realistic scenarios
- ✅ API endpoint specifications
- ✅ Security considerations
- ✅ Implementation checklists
- ✅ Frontend integration examples
- ✅ Email template examples

### Code Examples
- ✅ Token generation and verification
- ✅ Permission checking middleware
- ✅ Newsletter generation workflow
- ✅ React components (Login, Article View)
- ✅ Database queries and migrations

## 🎯 Use Cases Covered

### Email Newsletter Workflow
1. Admin/Teacher creates weekly class article (班級大小事)
2. System generates newsletter for each family
3. Newsletter contains temporary access links per article
4. Parents receive email with 30-minute, single-use links
5. Click link → View article (with or without login)
6. Encourages sign-up for permanent access

### Student Transfer Workflow
1. Student moves from one class to another
2. Old membership: status → TRANSFERRED, leftDate set
3. New membership: status → ACTIVE, joinedDate set
4. Historical record preserved for audit

### Parent Access Control
1. Parent logs in (Google or Magic Link)
2. System identifies their children (via family relationships)
3. Filters articles to only show children's class content
4. Enforced at database and application layers

## 🚀 Implementation Phases

### Phase 1: Database Setup
- Set up PostgreSQL
- Run schema creation scripts
- Set up migrations tool
- Create seed data

### Phase 2: Backend API
- Node.js/Express setup
- Authentication endpoints
- Permission middleware
- Article filtering

### Phase 3: Frontend
- React integration
- Login UI
- Article access flow
- Temporary access UI

### Phase 4: Email Integration
- Email service setup
- Newsletter generation
- Template rendering
- Token distribution

## 📈 Benefits

### For Users
- **Parents**: Easy access to relevant class content
- **Students**: Simple access to their class information
- **Teachers**: Streamlined content publishing
- **Families**: Can track non-student siblings

### For School
- **Security**: Passwordless reduces breach risks
- **Privacy**: Parents see only their data
- **Flexibility**: Supports complex family structures
- **Scalability**: Persistent classes grow with students

### For System
- **Modern**: Industry best practices
- **Secure**: Multiple layers of protection
- **Flexible**: Supports various authentication methods
- **Auditable**: Complete logging of sensitive operations

## 🔄 Version History

### v2.2 (2025-11-16) - Passwordless Authentication
- Removed password storage
- Added Google OAuth 2.0
- Added Email Magic Links
- Added temporary article access links

### v2.1 (2025-11-16) - Chinese Zodiac Naming
- Class names based on 60-year cycle
- Support for multiple classes per year
- Helper function for zodiac name generation

### v2.0 (2025-11-16) - Family Model
- Introduced Family, FamilyMember tables
- Single class membership constraint
- Persistent class model
- Transfer tracking

### v1.0 (2025-11-16) - Initial Design
- Basic user roles
- Direct parent-student relationships
- Class and article models

## 📚 Documentation Files

- **`docs/user-system-model.md`** (2.2) - 1,227 lines
- **`docs/authentication-authorization.md`** (2.0) - 1,210 lines

**Total**: 2,437 lines of comprehensive design documentation

## ✅ Ready for Implementation

All design documents are complete and ready for development:
- ✅ Database schemas with full constraints
- ✅ API specifications with permissions
- ✅ Security policies and best practices
- ✅ Frontend integration patterns
- ✅ Sample code and examples
- ✅ Implementation checklists

## 🎓 Waldorf Education Alignment

This design specifically supports Waldorf education practices:
- ✅ Chinese zodiac class naming (cultural heritage)
- ✅ Persistent classes (same teacher/classmates grow together)
- ✅ Family-centric approach (holistic view of family unit)
- ✅ Gentle technology (passwordless, email-based sharing)
- ✅ Privacy-first (parents see only their children's content)

---

**Impact**: Foundation for complete user authentication and authorization system
**Type**: Documentation / Design
**Status**: Ready for Review & Implementation
