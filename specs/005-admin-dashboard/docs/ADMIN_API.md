# Admin Dashboard API Documentation

**Version**: 1.0.0
**Date**: December 4, 2025
**Status**: ✅ Complete

---

## Overview

The Admin Dashboard API provides endpoints for managing newsletters, articles, classes, families, users, and audit logs. All endpoints require admin role authentication via Supabase.

**Base URL**: `https://[supabase-project].supabase.co`
**Authentication**: JWT Bearer Token (Supabase Auth)
**Response Format**: JSON

---

## Authentication

All admin endpoints require:
1. Valid JWT token from Supabase Auth
2. User must have `role = 'admin'` in `user_roles` table
3. Session validated via RLS policies

### Bearer Token Header
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Error Response (Unauthorized)
```json
{
  "error": "UNAUTHORIZED",
  "message": "Admin role required"
}
```

---

## Endpoints

### Newsletter Management

#### GET /admin/newsletters
**Description**: Fetch all newsletters with pagination, filtering, and sorting

**Query Parameters**:
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 50): Items per page
- `status` (optional): Filter by status (draft, published, archived)
- `sortBy` (optional): Sort field (weekNumber, publishDate, articleCount)
- `sortOrder` (optional): asc or desc

**Example Request**:
```bash
curl -H "Authorization: Bearer TOKEN" \
  "https://project.supabase.co/rest/v1/newsletters?page=1&limit=50&status=published&sortBy=publishDate"
```

**Success Response** (200):
```json
{
  "data": [
    {
      "id": "nl-001",
      "weekNumber": "2025-W48",
      "publishDate": "2025-12-01T00:00:00Z",
      "status": "published",
      "articleCount": 5,
      "createdAt": "2025-11-24T10:00:00Z",
      "updatedAt": "2025-11-30T15:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 248,
    "totalPages": 5
  }
}
```

#### POST /admin/newsletters
**Description**: Create a new newsletter

**Request Body**:
```json
{
  "weekNumber": "2025-W49",
  "publishDate": "2025-12-08T00:00:00Z"
}
```

**Validation**:
- weekNumber: Must be unique, format `YYYY-Www`
- publishDate: Must be valid ISO 8601 date

**Success Response** (201):
```json
{
  "id": "nl-002",
  "weekNumber": "2025-W49",
  "publishDate": "2025-12-08T00:00:00Z",
  "status": "draft",
  "articleCount": 0,
  "createdAt": "2025-12-04T10:00:00Z",
  "updatedAt": "2025-12-04T10:00:00Z"
}
```

#### PUT /admin/newsletters/:id
**Description**: Update newsletter status (publish, archive)

**Request Body**:
```json
{
  "status": "published",
  "lastModified": "2025-12-04T10:00:00Z"
}
```

**Success Response** (200):
```json
{
  "id": "nl-001",
  "status": "published",
  "publishedAt": "2025-12-04T10:05:00Z",
  "updatedAt": "2025-12-04T10:05:00Z"
}
```

#### DELETE /admin/newsletters/:id
**Description**: Delete a newsletter (only if draft)

**Success Response** (204): No content

#### Error Responses:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Cannot delete published newsletter"
}
```

---

### Article Management

#### GET /admin/articles/:weekNumber
**Description**: Fetch all articles for a week

**Query Parameters**:
- `status` (optional): Filter by status
- `author` (optional): Filter by author

**Success Response** (200):
```json
{
  "data": [
    {
      "id": "art-001",
      "title": "Weekly News",
      "content": "<p>Content...</p>",
      "author": "teacher@school.edu",
      "status": "published",
      "classRestrictions": ["class-001", "class-002"],
      "familyRestrictions": ["family-001"],
      "createdAt": "2025-11-24T10:00:00Z",
      "updatedAt": "2025-11-30T15:30:00Z"
    }
  ]
}
```

#### PUT /admin/articles/:id
**Description**: Update article with Last-Write-Wins conflict resolution

**Request Body**:
```json
{
  "title": "Updated Title",
  "content": "<p>Updated content</p>",
  "author": "admin@school.edu",
  "classRestrictions": ["class-001"],
  "familyRestrictions": [],
  "lastModified": "2025-12-04T10:00:00Z"
}
```

**Conflict Detection**:
- Server compares `lastModified` with server `updatedAt`
- If conflict detected, returns latest version

**Success Response** (200):
```json
{
  "id": "art-001",
  "title": "Updated Title",
  "updatedAt": "2025-12-04T10:05:00Z",
  "conflict": false
}
```

**Conflict Response** (409):
```json
{
  "error": "CONFLICT",
  "message": "Article was modified by another user",
  "serverVersion": {
    "title": "Server Title",
    "updatedAt": "2025-12-04T10:03:00Z",
    "updatedBy": "other_admin@school.edu"
  }
}
```

#### DELETE /admin/articles/:id
**Description**: Soft-delete an article

**Success Response** (204): No content

---

### Class Management

#### GET /admin/classes
**Description**: Fetch all classes

**Success Response** (200):
```json
{
  "data": [
    {
      "id": "class-001",
      "name": "Grade 1A",
      "description": "First Grade Section A",
      "studentCount": 25,
      "familyCount": 20,
      "createdAt": "2025-11-01T00:00:00Z",
      "updatedAt": "2025-12-04T10:00:00Z"
    }
  ]
}
```

#### POST /admin/classes
**Description**: Create a new class

**Request Body**:
```json
{
  "name": "Grade 2B",
  "description": "Second Grade Section B"
}
```

**Validation**:
- name: Required, unique, 1-100 characters
- description: Optional, 0-500 characters

**Success Response** (201):
```json
{
  "id": "class-002",
  "name": "Grade 2B",
  "description": "Second Grade Section B",
  "studentCount": 0,
  "familyCount": 0,
  "createdAt": "2025-12-04T10:00:00Z",
  "updatedAt": "2025-12-04T10:00:00Z"
}
```

#### POST /admin/classes/:classId/students/:studentId
**Description**: Enroll a student in a class

**Success Response** (201):
```json
{
  "classId": "class-001",
  "studentId": "student-001",
  "enrolledAt": "2025-12-04T10:00:00Z"
}
```

#### DELETE /admin/classes/:classId/students/:studentId
**Description**: Remove a student from a class

**Success Response** (204): No content

---

### Family Management

#### GET /admin/families
**Description**: Fetch all families

**Success Response** (200):
```json
{
  "data": [
    {
      "id": "family-001",
      "name": "Smith Family",
      "description": "Primary residence",
      "memberCount": 3,
      "createdAt": "2025-11-01T00:00:00Z",
      "updatedAt": "2025-12-04T10:00:00Z"
    }
  ]
}
```

#### POST /admin/families
**Description**: Create a new family

**Request Body**:
```json
{
  "name": "Johnson Family",
  "description": "Extended family group"
}
```

**Success Response** (201):
```json
{
  "id": "family-002",
  "name": "Johnson Family",
  "description": "Extended family group",
  "memberCount": 0,
  "createdAt": "2025-12-04T10:00:00Z",
  "updatedAt": "2025-12-04T10:00:00Z"
}
```

#### PUT /admin/families/:id
**Description**: Update family information

**Success Response** (200): Updated family object

#### DELETE /admin/families/:id
**Description**: Delete a family

**Success Response** (204): No content

---

### User Management

#### GET /admin/users
**Description**: Fetch all users with pagination and filtering

**Query Parameters**:
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 50): Items per page
- `role` (optional): Filter by role (admin, teacher, parent, student)
- `status` (optional): Filter by status (active, disabled, pending)
- `search` (optional): Search by email or name

**Success Response** (200):
```json
{
  "data": [
    {
      "id": "user-001",
      "email": "admin@school.edu",
      "name": "Admin User",
      "role": "admin",
      "status": "active",
      "lastLogin": "2025-12-04T09:00:00Z",
      "createdAt": "2025-11-01T00:00:00Z",
      "updatedAt": "2025-12-04T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1250,
    "totalPages": 25
  }
}
```

#### POST /admin/users
**Description**: Create a new user

**Request Body**:
```json
{
  "email": "teacher@school.edu",
  "name": "Teacher Name",
  "role": "teacher",
  "status": "active"
}
```

**Validation**:
- email: Required, unique, valid email format
- name: Required, 1-100 characters
- role: Required, must be one of (admin, teacher, parent, student)
- status: Optional, default 'pending'

**Success Response** (201):
```json
{
  "id": "user-002",
  "email": "teacher@school.edu",
  "name": "Teacher Name",
  "role": "teacher",
  "status": "active",
  "createdAt": "2025-12-04T10:00:00Z",
  "updatedAt": "2025-12-04T10:00:00Z"
}
```

**Validation Error** (422):
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Email already exists"
}
```

#### PUT /admin/users/:id
**Description**: Update user information or role

**Request Body**:
```json
{
  "role": "admin",
  "status": "active"
}
```

**Success Response** (200): Updated user object

#### DELETE /admin/users/:id
**Description**: Delete a user

**Success Response** (204): No content

#### Error Response (403):
```json
{
  "error": "FORBIDDEN",
  "message": "Cannot delete the last admin user"
}
```

---

### Batch Import

#### POST /admin/users/batch
**Description**: Batch import users from CSV with all-or-nothing validation

**Request**:
```
Content-Type: multipart/form-data

Form Data:
- file: <CSV file>
```

**CSV Format**:
```csv
email,name,role,status
teacher1@school.edu,Teacher One,teacher,active
teacher2@school.edu,Teacher Two,teacher,active
parent1@school.edu,Parent One,parent,active
```

**Validation Rules**:
1. All rows must be valid before any insert
2. Email must be unique (across batch and database)
3. Role must be valid (admin, teacher, parent, student)
4. Status must be valid (active, disabled, pending)

**Success Response** (200):
```json
{
  "status": "success",
  "imported": 3,
  "failed": 0,
  "details": [
    {
      "email": "teacher1@school.edu",
      "status": "created",
      "userId": "user-001"
    }
  ]
}
```

**Validation Failure** (422):
```json
{
  "status": "failed",
  "imported": 0,
  "failed": 3,
  "errors": [
    {
      "row": 2,
      "email": "invalid-email",
      "error": "Invalid email format"
    },
    {
      "row": 3,
      "email": "duplicate@school.edu",
      "error": "Email already exists"
    }
  ],
  "message": "Batch import failed. No records were imported (all-or-nothing strategy)"
}
```

---

### Parent-Student Relationships

#### GET /admin/relationships
**Description**: Fetch all parent-student relationships

**Query Parameters**:
- `parentId` (optional): Filter by parent
- `studentId` (optional): Filter by student

**Success Response** (200):
```json
{
  "data": [
    {
      "id": "rel-001",
      "parentId": "parent-001",
      "parentName": "Parent Name",
      "studentId": "student-001",
      "studentName": "Student Name",
      "createdAt": "2025-11-01T00:00:00Z"
    }
  ]
}
```

#### POST /admin/relationships
**Description**: Link a parent to a student

**Request Body**:
```json
{
  "parentId": "parent-001",
  "studentId": "student-001"
}
```

**Success Response** (201):
```json
{
  "id": "rel-001",
  "parentId": "parent-001",
  "studentId": "student-001",
  "createdAt": "2025-12-04T10:00:00Z"
}
```

#### DELETE /admin/relationships/:id
**Description**: Unlink a parent from a student

**Success Response** (204): No content

---

### Audit Logs

#### GET /admin/audit-logs
**Description**: Fetch audit logs with filtering

**Query Parameters**:
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 50): Items per page
- `operation` (optional): Filter by operation type
- `startDate` (optional): Filter logs after this date
- `endDate` (optional): Filter logs before this date

**Success Response** (200):
```json
{
  "data": [
    {
      "id": "log-001",
      "operation": "UPDATE_USER",
      "operator": "admin@school.edu",
      "resourceId": "user-001",
      "resourceType": "user",
      "details": {
        "changed": ["role"],
        "fromRole": "teacher",
        "toRole": "admin"
      },
      "createdAt": "2025-12-04T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 5000,
    "totalPages": 100
  }
}
```

**Supported Operations**:
- CREATE_USER
- UPDATE_USER
- DELETE_USER
- CHANGE_ROLE
- CREATE_NEWSLETTER
- UPDATE_NEWSLETTER
- PUBLISH_NEWSLETTER
- ARCHIVE_NEWSLETTER
- DELETE_NEWSLETTER
- CREATE_ARTICLE
- UPDATE_ARTICLE
- DELETE_ARTICLE
- BATCH_IMPORT_USER
- CONFLICT_RESOLVED
- PURGE_AUDIT_LOGS

#### Auto-Purge
Logs older than 30 days are automatically purged daily at 02:00 UTC.

---

## Rate Limiting

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1733400000
```

- Admin endpoints: 1000 requests per hour
- User endpoints: 100 requests per hour

**Error Response** (429):
```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Try again later.",
  "retryAfter": 3600
}
```

---

## Error Handling

### Common Error Codes

| Code | Status | Message | Description |
|------|--------|---------|-------------|
| UNAUTHORIZED | 401 | Not authenticated | Missing or invalid JWT token |
| FORBIDDEN | 403 | Permission denied | User lacks admin role |
| NOT_FOUND | 404 | Resource not found | Newsletter/user not found |
| VALIDATION_ERROR | 422 | Invalid input | Data validation failed |
| CONFLICT | 409 | Conflict | Last-Write-Wins conflict detected |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests | Rate limit exceeded |
| INTERNAL_SERVER_ERROR | 500 | Server error | Unexpected server error |

### Error Response Format
```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {}
}
```

---

## Data Types

### Newsletter Status
- `draft` - Not yet published
- `published` - Live and visible to users
- `archived` - Archived, not visible in main list

### User Role
- `admin` - Full administrative access
- `teacher` - Can manage own articles
- `parent` - Can view children's content
- `student` - Read-only access

### User Status
- `active` - Can access system
- `disabled` - Cannot access system
- `pending` - Awaiting approval

### Article Status
- `draft` - Work in progress
- `published` - Published in newsletter
- `archived` - Archived version

---

## Pagination

All list endpoints support pagination:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 248,
    "totalPages": 5
  }
}
```

---

## Concurrency Control (Last-Write-Wins)

When updating articles or newsletters:

1. Client sends `lastModified` timestamp from last fetch
2. Server compares with current `updatedAt`
3. If `lastModified < updatedAt`: Conflict detected
4. Server returns latest version with error code 409
5. Client can choose to:
   - Merge changes manually
   - Overwrite with latest version
   - Discard changes

---

## Examples

### Complete Article Edit Workflow
```bash
# 1. Fetch article
curl -H "Authorization: Bearer TOKEN" \
  https://project.supabase.co/rest/v1/articles/art-001

# 2. Update article (no conflict)
curl -X PUT -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Title",
    "lastModified": "2025-12-04T10:00:00Z"
  }' \
  https://project.supabase.co/rest/v1/articles/art-001

# Response: 200 OK with updated article

# 3. If conflict (409), fetch latest version and retry
curl -H "Authorization: Bearer TOKEN" \
  https://project.supabase.co/rest/v1/articles/art-001
```

### Batch User Import Workflow
```bash
# 1. Prepare CSV file (users.csv)
# 2. Upload
curl -X POST -H "Authorization: Bearer TOKEN" \
  -F "file=@users.csv" \
  https://project.supabase.co/rest/v1/users/batch

# Response: 200 with import results
```

---

## Testing Endpoints

### Authentication Test
```bash
curl -H "Authorization: Bearer INVALID_TOKEN" \
  https://project.supabase.co/rest/v1/newsletters

# Expected: 401 Unauthorized
```

### Admin Role Test
```bash
# With teacher role
curl -H "Authorization: Bearer TEACHER_TOKEN" \
  https://project.supabase.co/rest/v1/newsletters

# Expected: 403 Forbidden - Admin role required
```

---

## Status & Support

**Status**: ✅ Production Ready
**Last Updated**: December 4, 2025
**Support**: admin-support@school.edu

---

## Changelog

### v1.0.0 (2025-12-04)
- Initial release with full admin functionality
- Newsletter management
- Article management with LWW conflict resolution
- User management with batch import
- Audit logging with 30-day retention
- Parent-student relationship management
