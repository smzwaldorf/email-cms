# API Reference: Email CMS Newsletter Viewer

Complete documentation of all API endpoints and services for the Email CMS Database Structure application.

**Table of Contents:**
- [Overview](#overview)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Article Service](#article-service)
- [Week Service](#week-service)
- [Class Service](#class-service)
- [Family Service](#family-service)
- [Article Update Service](#article-update-service)
- [Query Services](#query-services)
- [Response Models](#response-models)
- [Error Codes](#error-codes)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

---

## Overview

The Email CMS API provides RESTful endpoints built on Supabase for managing newsletters, articles, and family/class-based content visibility.

**Base URL**: `https://your-project.supabase.co/rest/v1`

**Technology Stack**:
- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth (JWT tokens)
- **Response Format**: JSON
- **Content Type**: `application/json`

**Current Phase**: Database Structure & Service Layer (Phase 6-7)
**Status**: Service layer complete, API layer ready for REST endpoint implementation

---

## Authentication

### Current Status (Phase 6-7)
Authentication framework is prepared for Phase 8 implementation. Currently uses:
- **Supabase Anonymous Key** (development/testing)
- **Service Role Key** (server-side operations)

### Future Implementation (Phase 8)
- JWT token-based authentication via Supabase Auth
- User roles: admin, teacher, parent, viewer
- Row-Level Security (RLS) policies per role
- Token refresh mechanism

### Headers (Future)
```
Authorization: Bearer <jwt_token>
X-API-Key: <optional_api_key_for_service_accounts>
```

---

## Error Handling

### Standard Error Response Format
```json
{
  "error": {
    "code": "ARTICLE_NOT_FOUND",
    "message": "Article with ID 'abc-123' not found",
    "status": 404,
    "details": {
      "articleId": "abc-123",
      "week": "2025-W47"
    }
  }
}
```

### HTTP Status Codes
- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `204 No Content` - Success with no content to return
- `400 Bad Request` - Invalid input parameters
- `401 Unauthorized` - Authentication required or invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Constraint violation (e.g., duplicate article_order)
- `422 Unprocessable Entity` - Validation error
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Database connection issues

---

## Article Service

Service for managing newsletter articles with visibility control and audit logging.

### Create Article
**Endpoint**: `POST /articles`

**Request**:
```json
{
  "week_number": "2025-W47",
  "title": "Class Updates - Week 47",
  "content": "# Weekly Updates\n\nMarkdown content here...",
  "author": "teacher-001",
  "visibility_type": "public",
  "restricted_to_classes": null,
  "article_order": 1
}
```

**Response** (201 Created):
```json
{
  "id": "article-abc123",
  "week_number": "2025-W47",
  "title": "Class Updates - Week 47",
  "content": "# Weekly Updates\n\nMarkdown content here...",
  "author": "teacher-001",
  "article_order": 1,
  "is_published": false,
  "visibility_type": "public",
  "restricted_to_classes": null,
  "created_by": "teacher-001",
  "created_at": "2025-11-17T10:30:00Z",
  "updated_at": "2025-11-17T10:30:00Z",
  "deleted_at": null
}
```

**Error Cases**:
- `400 Bad Request` - Missing required fields (week_number, title, content)
- `400 Bad Request` - Invalid visibility_type (must be 'public' or 'class_restricted')
- `400 Bad Request` - visibility_type='class_restricted' but restricted_to_classes is empty
- `409 Conflict` - Duplicate article_order for same week_number

---

### Get Article
**Endpoint**: `GET /articles/{articleId}`

**Request**:
```bash
curl -X GET "https://your-project.supabase.co/rest/v1/articles/article-abc123" \
  -H "apikey: your-anon-key" \
  -H "Authorization: Bearer your-jwt-token"
```

**Response** (200 OK):
```json
{
  "id": "article-abc123",
  "week_number": "2025-W47",
  "title": "Class Updates - Week 47",
  "content": "# Weekly Updates\n\nMarkdown content...",
  "author": "teacher-001",
  "article_order": 1,
  "is_published": true,
  "visibility_type": "public",
  "restricted_to_classes": null,
  "created_by": "teacher-001",
  "created_at": "2025-11-17T10:30:00Z",
  "updated_at": "2025-11-17T10:45:00Z",
  "deleted_at": null
}
```

**Error Cases**:
- `404 Not Found` - Article does not exist
- `403 Forbidden` - User lacks permission to view article

---

### List Articles for Week
**Endpoint**: `GET /articles?week_number=eq.2025-W47&order=article_order.asc`

**Query Parameters**:
- `week_number` (string, required) - ISO week number (2025-W47)
- `visibility_type` (string, optional) - Filter by 'public' or 'class_restricted'
- `is_published` (boolean, optional) - Filter by publication status
- `order` (string, optional) - Sort order (article_order.asc, created_at.desc)
- `limit` (integer, optional) - Limit results (default: 100, max: 1000)
- `offset` (integer, optional) - Pagination offset

**Request**:
```bash
curl -X GET "https://your-project.supabase.co/rest/v1/articles?week_number=eq.2025-W47&is_published=eq.true&order=article_order.asc" \
  -H "apikey: your-anon-key"
```

**Response** (200 OK):
```json
[
  {
    "id": "article-1",
    "week_number": "2025-W47",
    "title": "Monday Updates",
    "content": "# Monday\n\nContent...",
    "author": "teacher-001",
    "article_order": 1,
    "is_published": true,
    "visibility_type": "public",
    "restricted_to_classes": null,
    "created_by": "teacher-001",
    "created_at": "2025-11-17T08:00:00Z",
    "updated_at": "2025-11-17T08:00:00Z",
    "deleted_at": null
  },
  {
    "id": "article-2",
    "week_number": "2025-W47",
    "title": "Grade 1A Class News",
    "content": "# Grade 1A Updates\n\nContent...",
    "author": "teacher-002",
    "article_order": 2,
    "is_published": true,
    "visibility_type": "class_restricted",
    "restricted_to_classes": ["A1"],
    "created_by": "teacher-002",
    "created_at": "2025-11-17T09:00:00Z",
    "updated_at": "2025-11-17T09:00:00Z",
    "deleted_at": null
  }
]
```

**Performance**:
- <100ms for typical weekly articles (10-50 articles)
- <500ms for large weeks (100+ articles)
- Indexes on (week_number, article_order) and (is_published)

---

### Update Article
**Endpoint**: `PATCH /articles/{articleId}`

**Request**:
```json
{
  "title": "Updated Title",
  "content": "# Updated Content\n\nNew markdown...",
  "visibility_type": "class_restricted",
  "restricted_to_classes": ["A1", "A2"]
}
```

**Response** (200 OK):
```json
{
  "id": "article-abc123",
  "week_number": "2025-W47",
  "title": "Updated Title",
  "content": "# Updated Content\n\nNew markdown...",
  "author": "teacher-001",
  "article_order": 1,
  "is_published": true,
  "visibility_type": "class_restricted",
  "restricted_to_classes": ["A1", "A2"],
  "created_by": "teacher-001",
  "created_at": "2025-11-17T10:30:00Z",
  "updated_at": "2025-11-17T11:00:00Z",
  "deleted_at": null
}
```

**Error Cases**:
- `404 Not Found` - Article does not exist
- `400 Bad Request` - Invalid visibility_type
- `400 Bad Request` - visibility_type='class_restricted' with empty restricted_to_classes
- `409 Conflict` - New article_order conflicts with existing article

**Audit Logging**: All updates are logged in article_audit_log table with:
- Old and new values
- Change timestamp
- User who made the change
- Operation type (UPDATE)

---

### Publish Article
**Endpoint**: `POST /articles/{articleId}/publish`

**Request**:
```bash
curl -X POST "https://your-project.supabase.co/rest/v1/articles/article-abc123/publish" \
  -H "apikey: your-anon-key" \
  -H "Content-Type: application/json"
```

**Response** (200 OK):
```json
{
  "id": "article-abc123",
  "is_published": true,
  "published_at": "2025-11-17T11:30:00Z"
}
```

**Error Cases**:
- `404 Not Found` - Article does not exist
- `403 Forbidden` - User not authorized to publish

---

### Delete Article (Soft Delete)
**Endpoint**: `DELETE /articles/{articleId}`

**Request**:
```bash
curl -X DELETE "https://your-project.supabase.co/rest/v1/articles/article-abc123" \
  -H "apikey: your-anon-key"
```

**Response** (204 No Content)

**Implementation Details**:
- Sets `deleted_at` timestamp (soft delete)
- Article remains in database for audit trail
- Automatically excluded from queries (WHERE deleted_at IS NULL)
- Can be restored by clearing deleted_at (Phase 8 feature)

**Error Cases**:
- `404 Not Found` - Article does not exist
- `403 Forbidden` - User not authorized to delete

---

### Get Articles for Class
**Endpoint**: `GET /articles?class_id=eq.A1&week_number=eq.2025-W47`

**Service Method**: `ArticleService.getArticlesForClass(classId, weekNumber)`

**Request**:
```bash
curl -X GET "https://your-project.supabase.co/rest/v1/articles?class_id=eq.A1&week_number=eq.2025-W47" \
  -H "apikey: your-anon-key"
```

**Response** (200 OK):
```json
[
  {
    "id": "article-1",
    "title": "School-wide announcement",
    "visibility_type": "public",
    "restricted_to_classes": null
  },
  {
    "id": "article-3",
    "title": "Grade 1A Class Updates",
    "visibility_type": "class_restricted",
    "restricted_to_classes": ["A1"]
  }
]
```

**Performance**: <100ms for typical class article queries

---

### Set Article Class Restriction
**Endpoint**: `POST /articles/{articleId}/restrict-classes`

**Service Method**: `ArticleService.setArticleClassRestriction(articleId, classIds)`

**Request**:
```json
{
  "restricted_to_classes": ["A1", "A2", "B1"]
}
```

**Response** (200 OK):
```json
{
  "id": "article-abc123",
  "visibility_type": "class_restricted",
  "restricted_to_classes": ["A1", "A2", "B1"],
  "updated_at": "2025-11-17T11:45:00Z"
}
```

**Error Cases**:
- `400 Bad Request` - Empty class list (must have at least 1 class)
- `404 Not Found` - Invalid class IDs
- `422 Unprocessable Entity` - Class IDs don't exist

---

### Remove Article Class Restriction
**Endpoint**: `POST /articles/{articleId}/unrestrict`

**Service Method**: `ArticleService.removeArticleClassRestriction(articleId)`

**Request**:
```bash
curl -X POST "https://your-project.supabase.co/rest/v1/articles/article-abc123/unrestrict" \
  -H "apikey: your-anon-key" \
  -H "Content-Type: application/json"
```

**Response** (200 OK):
```json
{
  "id": "article-abc123",
  "visibility_type": "public",
  "restricted_to_classes": null,
  "updated_at": "2025-11-17T11:50:00Z"
}
```

---

## Week Service

Service for managing newsletter weeks and scheduling.

### Create Newsletter Week
**Endpoint**: `POST /newsletter_weeks`

**Request**:
```json
{
  "week_number": "2025-W48",
  "week_start_date": "2025-11-24",
  "week_end_date": "2025-11-30",
  "is_published": false
}
```

**Response** (201 Created):
```json
{
  "id": "week-w48-2025",
  "week_number": "2025-W48",
  "week_start_date": "2025-11-24",
  "week_end_date": "2025-11-30",
  "is_published": false,
  "created_at": "2025-11-17T12:00:00Z",
  "updated_at": "2025-11-17T12:00:00Z",
  "deleted_at": null
}
```

---

### Get Week
**Endpoint**: `GET /newsletter_weeks/{weekId}`

**Response** (200 OK):
```json
{
  "id": "week-w47-2025",
  "week_number": "2025-W47",
  "week_start_date": "2025-11-17",
  "week_end_date": "2025-11-23",
  "is_published": true,
  "created_at": "2025-11-10T08:00:00Z",
  "updated_at": "2025-11-17T10:00:00Z",
  "deleted_at": null
}
```

---

### List Weeks
**Endpoint**: `GET /newsletter_weeks?order=week_number.desc&limit=10`

**Query Parameters**:
- `order` (string, optional) - week_number.desc or week_number.asc
- `is_published` (boolean, optional) - Filter by publication status
- `limit` (integer, optional) - Default: 100, Max: 500
- `offset` (integer, optional) - Pagination offset

**Response** (200 OK):
```json
[
  {
    "id": "week-w47-2025",
    "week_number": "2025-W47",
    "week_start_date": "2025-11-17",
    "week_end_date": "2025-11-23",
    "is_published": true,
    "created_at": "2025-11-10T08:00:00Z",
    "updated_at": "2025-11-17T10:00:00Z",
    "deleted_at": null
  }
]
```

---

## Class Service

Service for managing class definitions and hierarchy.

### Create Class
**Endpoint**: `POST /classes`

**Request**:
```json
{
  "class_name": "Grade 1A",
  "class_grade_year": 1
}
```

**Response** (201 Created):
```json
{
  "id": "A1",
  "class_name": "Grade 1A",
  "class_grade_year": 1,
  "created_at": "2025-11-17T12:00:00Z"
}
```

---

### Get Class
**Endpoint**: `GET /classes/{classId}`

**Response** (200 OK):
```json
{
  "id": "A1",
  "class_name": "Grade 1A",
  "class_grade_year": 1,
  "created_at": "2025-11-17T12:00:00Z"
}
```

---

### List All Classes
**Endpoint**: `GET /classes?order=class_grade_year.desc,class_name.asc`

**Query Parameters**:
- `class_grade_year` (integer, optional) - Filter by grade year
- `order` (string, optional) - Sort order

**Response** (200 OK):
```json
[
  {
    "id": "B2",
    "class_name": "Grade 2B",
    "class_grade_year": 2,
    "created_at": "2025-11-17T12:00:00Z"
  },
  {
    "id": "B1",
    "class_name": "Grade 2A",
    "class_grade_year": 2,
    "created_at": "2025-11-17T12:00:00Z"
  },
  {
    "id": "A1",
    "class_name": "Grade 1A",
    "class_grade_year": 1,
    "created_at": "2025-11-17T12:00:00Z"
  }
]
```

---

### Get Classes by Grade Year
**Endpoint**: `GET /classes?class_grade_year=eq.2&order=class_name.asc`

**Service Method**: `ClassService.getClassesByGradeYear(gradeYear)`

**Response** (200 OK):
```json
[
  {
    "id": "A2",
    "class_name": "Grade 2A",
    "class_grade_year": 2,
    "created_at": "2025-11-17T12:00:00Z"
  },
  {
    "id": "B2",
    "class_name": "Grade 2B",
    "class_grade_year": 2,
    "created_at": "2025-11-17T12:00:00Z"
  }
]
```

---

## Family Service

Service for managing parent-child-class relationships.

### Get Family
**Endpoint**: `GET /families/{familyId}`

**Response** (200 OK):
```json
{
  "id": "family-001",
  "family_code": "FAM-2025-001",
  "created_at": "2025-11-17T12:00:00Z",
  "family_enrollment": [
    {
      "id": "enroll-001",
      "parent_id": "parent-001",
      "family_id": "family-001",
      "enrolled_at": "2025-11-17T12:00:00Z"
    }
  ],
  "child_class_enrollment": [
    {
      "id": "enroll-child-001",
      "child_id": "child-001",
      "class_id": "A1",
      "enrolled_at": "2025-11-01T08:00:00Z",
      "graduated_at": null
    },
    {
      "id": "enroll-child-002",
      "child_id": "child-002",
      "class_id": "B1",
      "enrolled_at": "2025-11-01T08:00:00Z",
      "graduated_at": null
    }
  ]
}
```

---

### Get Children's Classes for Family
**Endpoint**: `GET /families/{familyId}/classes`

**Service Method**: `FamilyService.getChildrenClasses(familyId)`

**Response** (200 OK):
```json
[
  {
    "id": "B1",
    "class_name": "Grade 2B",
    "class_grade_year": 2,
    "created_at": "2025-11-17T12:00:00Z"
  },
  {
    "id": "A1",
    "class_name": "Grade 1A",
    "class_grade_year": 1,
    "created_at": "2025-11-17T12:00:00Z"
  }
]
```

**Performance**: <50ms for families with up to 5 children

**Details**:
- Returns classes sorted by grade_year DESC (older children first)
- Excludes graduated children (graduated_at IS NOT NULL)
- Deduplicates classes (children in same class appear once)

---

### Enroll Child in Class
**Endpoint**: `POST /child_class_enrollment`

**Request**:
```json
{
  "child_id": "child-001",
  "class_id": "A1",
  "enrolled_at": "2025-11-01T08:00:00Z"
}
```

**Response** (201 Created):
```json
{
  "id": "enroll-child-001",
  "child_id": "child-001",
  "class_id": "A1",
  "enrolled_at": "2025-11-01T08:00:00Z",
  "graduated_at": null
}
```

---

### Enroll Parent in Family
**Endpoint**: `POST /family_enrollment`

**Request**:
```json
{
  "parent_id": "parent-001",
  "family_id": "family-001",
  "enrolled_at": "2025-11-17T12:00:00Z"
}
```

**Response** (201 Created):
```json
{
  "id": "enroll-001",
  "parent_id": "parent-001",
  "family_id": "family-001",
  "enrolled_at": "2025-11-17T12:00:00Z"
}
```

---

## Article Update Service

Service for tracking and auditing article modifications.

### Get Article Audit Log
**Endpoint**: `GET /article_audit_log?article_id=eq.{articleId}&order=created_at.desc`

**Query Parameters**:
- `article_id` (string, required) - Article ID to audit
- `operation` (string, optional) - Filter by 'CREATE', 'UPDATE', 'DELETE'
- `order` (string, optional) - Sort order (created_at.desc)
- `limit` (integer, optional) - Default: 100, Max: 1000

**Response** (200 OK):
```json
[
  {
    "id": "audit-001",
    "article_id": "article-abc123",
    "operation": "UPDATE",
    "old_values": {
      "title": "Original Title"
    },
    "new_values": {
      "title": "Updated Title"
    },
    "changed_by": "teacher-001",
    "created_at": "2025-11-17T11:00:00Z"
  },
  {
    "id": "audit-002",
    "article_id": "article-abc123",
    "operation": "CREATE",
    "old_values": null,
    "new_values": {
      "id": "article-abc123",
      "title": "Original Title",
      "content": "..."
    },
    "changed_by": "teacher-001",
    "created_at": "2025-11-17T10:30:00Z"
  }
]
```

**Automatic Triggers**:
- All article updates automatically logged
- Timestamps maintained via database trigger (update articles set updated_at = now())
- Full before/after comparison available

---

## Query Services

Additional query services for complex data retrieval.

### Get Articles for Family (Class-Aware)
**Service Method**: `getArticlesForFamily(familyId, weekNumber)`

**Details**:
- Returns all public articles for the week
- Returns class-restricted articles for children's classes only
- Deduplicates articles (if multiple children in same class)
- Sorted by class_grade_year DESC, then article_order ASC
- Respects soft-delete (deleted_at IS NULL)

**Performance**: <100ms for families with up to 5 children, 50+ articles

**Location**: `src/services/queries/classArticleQueries.ts`

---

## Response Models

### Article Row
```typescript
interface ArticleRow {
  id: string
  week_number: string
  title: string
  content: string
  author: string
  article_order: number
  is_published: boolean
  visibility_type: 'public' | 'class_restricted'
  restricted_to_classes: string[] | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}
```

### Newsletter Week Row
```typescript
interface NewsletterWeekRow {
  id: string
  week_number: string
  week_start_date: string
  week_end_date: string
  is_published: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}
```

### Class Row
```typescript
interface ClassRow {
  id: string
  class_name: string
  class_grade_year: number
  created_at: string
}
```

### Family Row
```typescript
interface FamilyRow {
  id: string
  family_code: string
  created_at: string
}
```

### Article Audit Log Row
```typescript
interface ArticleAuditLogRow {
  id: string
  article_id: string
  operation: 'CREATE' | 'UPDATE' | 'DELETE'
  old_values: Record<string, any> | null
  new_values: Record<string, any> | null
  changed_by: string
  created_at: string
}
```

---

## Error Codes

### Validation Errors (400)
- `INVALID_WEEK_FORMAT` - Week number not in ISO format (YYYY-Www)
- `INVALID_VISIBILITY_TYPE` - visibility_type must be 'public' or 'class_restricted'
- `EMPTY_CLASS_RESTRICTION` - visibility_type='class_restricted' requires at least 1 class
- `MISSING_REQUIRED_FIELD` - Required field missing from request
- `INVALID_ARTICLE_ORDER` - article_order must be positive integer

### Not Found Errors (404)
- `ARTICLE_NOT_FOUND` - Article with given ID does not exist
- `WEEK_NOT_FOUND` - Newsletter week does not exist
- `CLASS_NOT_FOUND` - Class with given ID does not exist
- `FAMILY_NOT_FOUND` - Family does not exist

### Conflict Errors (409)
- `DUPLICATE_ARTICLE_ORDER` - article_order already exists for this week
- `DUPLICATE_CLASS` - Class already exists with same name

### Permission Errors (403)
- `INSUFFICIENT_PERMISSIONS` - User lacks permission for this action
- `UNAUTHORIZED_ACCESS` - User cannot access this resource

### Unprocessable Entity Errors (422)
- `INVALID_CLASS_ID` - Class ID does not exist
- `SOFT_DELETE_FAILED` - Could not mark article as deleted

---

## Rate Limiting

### Current Status
No rate limiting implemented (Phase 6-7).

### Planned Implementation (Phase 8)
- **Anonymous requests**: 100 requests per minute per IP
- **Authenticated requests**: 1000 requests per minute per user
- **Admin requests**: 10,000 requests per minute
- **Response headers**:
  ```
  RateLimit-Limit: 100
  RateLimit-Remaining: 95
  RateLimit-Reset: 1637098200
  ```

---

## Examples

### Complete Workflow: Create and Publish Article

#### 1. Create Article
```bash
curl -X POST "https://your-project.supabase.co/rest/v1/articles" \
  -H "apikey: your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{
    "week_number": "2025-W47",
    "title": "Monday Class Updates",
    "content": "# Monday Updates\n\n- Math quiz next week\n- PE class moved to Wed",
    "author": "teacher-001",
    "visibility_type": "class_restricted",
    "restricted_to_classes": ["A1", "A2"]
  }'
```

**Response**:
```json
{
  "id": "article-123",
  "week_number": "2025-W47",
  "title": "Monday Class Updates",
  "is_published": false,
  "visibility_type": "class_restricted",
  "restricted_to_classes": ["A1", "A2"],
  "created_at": "2025-11-17T08:00:00Z"
}
```

#### 2. Publish Article
```bash
curl -X POST "https://your-project.supabase.co/rest/v1/articles/article-123/publish" \
  -H "apikey: your-anon-key" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "id": "article-123",
  "is_published": true,
  "published_at": "2025-11-17T09:00:00Z"
}
```

#### 3. View as Parent
```bash
# Parent calls getArticlesForFamily service
# Returns all public articles + articles for children's classes only
curl -X GET "https://your-project.supabase.co/rest/v1/articles?week_number=eq.2025-W47" \
  -H "apikey: your-anon-key"
```

**Response** (filtered by RLS policies):
- Article is visible because parent has child in class A1
- Article would NOT be visible if parent had no children in A1 or A2

---

### Update Article Visibility

#### Change from Public to Class-Restricted
```bash
curl -X PATCH "https://your-project.supabase.co/rest/v1/articles/article-123" \
  -H "apikey: your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{
    "visibility_type": "class_restricted",
    "restricted_to_classes": ["A1"]
  }'
```

#### Revert to Public
```bash
curl -X POST "https://your-project.supabase.co/rest/v1/articles/article-123/unrestrict" \
  -H "apikey: your-anon-key" \
  -H "Content-Type: application/json"
```

---

### Get Audit Trail
```bash
curl -X GET "https://your-project.supabase.co/rest/v1/article_audit_log?article_id=eq.article-123&order=created_at.desc" \
  -H "apikey: your-anon-key"
```

**Response**:
```json
[
  {
    "id": "audit-3",
    "article_id": "article-123",
    "operation": "UPDATE",
    "changed_by": "teacher-001",
    "created_at": "2025-11-17T11:00:00Z",
    "old_values": {
      "visibility_type": "public",
      "restricted_to_classes": null
    },
    "new_values": {
      "visibility_type": "class_restricted",
      "restricted_to_classes": ["A1"]
    }
  }
]
```

---

### Family Multi-Class Scenario
```bash
# Parent with 2 children in different classes
# Child 1 in Grade 1A (class_id: A1)
# Child 2 in Grade 2B (class_id: B2)

# Get all relevant articles for this family
curl -X GET "https://your-project.supabase.co/rest/v1/families/family-001/articles?week_number=eq.2025-W47" \
  -H "apikey: your-anon-key"
```

**Response** includes:
- All public articles
- Articles restricted to class A1 (visible for child 1)
- Articles restricted to class B2 (visible for child 2)
- No duplicates even if article visible to both classes
- Sorted by class_grade_year DESC (B2 before A1), then article_order ASC

---

## Future Enhancements (Phase 8+)

### Planned API Improvements
1. **Pagination**: Standardized cursor-based pagination
2. **Webhooks**: Real-time updates via webhooks
3. **GraphQL**: Alternative GraphQL endpoint
4. **Batch Operations**: Multi-article create/update/delete
5. **File Uploads**: Image/attachment handling for articles
6. **Full-Text Search**: Search articles by content
7. **Caching**: ETags and conditional request support
8. **API Versioning**: v1, v2 endpoints for backward compatibility

### Performance Optimizations
1. **Response Compression**: gzip compression for large responses
2. **Query Caching**: Redis caching for frequently accessed data
3. **Database Indexing**: Additional indexes for common queries
4. **Connection Pooling**: Better database connection management

---

**Last Updated**: 2025-11-17
**API Version**: 1.0 (Draft - Phase 6-7)
**Status**: Service layer complete, REST endpoint documentation ready for Phase 8 implementation
