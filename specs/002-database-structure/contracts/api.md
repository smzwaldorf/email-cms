# REST API Contracts

**Feature**: 002-database-structure
**Version**: 1.0.0
**Status**: Ready for Implementation

---

## Overview

This document defines all REST API endpoints for the Email CMS Newsletter Viewer. Endpoints are organized by resource and include authentication requirements, request/response schemas, and error codes.

### Base URL

**Development**: `http://localhost:5173/api`
**Production**: `https://{domain}/api`

### Authentication

All endpoints use Supabase authentication:
- **Public endpoints**: No authentication required (marked with 🔓)
- **Authenticated endpoints**: Bearer token required (marked with 🔐)
- **Admin-only endpoints**: Admin role required (marked with 🔑)

### Common Response Structure

All responses follow a consistent structure:

```json
{
  "status": "success|error",
  "data": {},
  "error": null,
  "timestamp": "2025-11-17T10:00:00Z"
}
```

### Error Response

```json
{
  "status": "error",
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  },
  "timestamp": "2025-11-17T10:00:00Z"
}
```

---

## Article Endpoints

### GET /api/articles

🔓 **Get published articles for a week**

Fetch all published articles for a specific week. If user is authenticated, returns personalized articles based on their enrolled classes.

**Query Parameters**:
```typescript
{
  week: string         // ISO week format (required): "2025-W47"
  limit?: number       // Max results (default: 100, max: 500)
  offset?: number      // Pagination offset (default: 0)
}
```

**Response** (200 OK):
```json
{
  "status": "success",
  "data": {
    "weekNumber": "2025-W47",
    "releasDate": "2025-11-17",
    "isPublished": true,
    "articles": [
      {
        "id": "uuid-1",
        "title": "Weekly Announcement",
        "content": "# Markdown content...",
        "author": "Admin",
        "articleOrder": 1,
        "visibilityType": "public",
        "restrictedToClasses": null,
        "isPublished": true,
        "createdAt": "2025-11-16T10:00:00Z",
        "updatedAt": "2025-11-16T10:00:00Z"
      }
    ],
    "total": 1,
    "timestamp": "2025-11-17T10:00:00Z"
  }
}
```

**Error Responses**:
- `400 BAD_REQUEST`: Invalid week format
- `404 WEEK_NOT_FOUND`: Week does not exist
- `429 TOO_MANY_REQUESTS`: Rate limit exceeded

**Performance Target**: <500ms (SC-001)

---

### GET /api/articles/{id}

🔓 **Get a single article**

Fetch a single article by ID. Checks publication and visibility status automatically.

**Path Parameters**:
```typescript
{
  id: string  // Article UUID
}
```

**Query Parameters**:
```typescript
{
  includeAuditLog?: boolean  // Include change history (default: false)
}
```

**Response** (200 OK):
```json
{
  "status": "success",
  "data": {
    "id": "uuid-1",
    "weekNumber": "2025-W47",
    "title": "Article Title",
    "content": "# Markdown content",
    "author": "Ms. Chen",
    "articleOrder": 1,
    "visibilityType": "class_restricted",
    "restrictedToClasses": ["A1", "A2"],
    "isPublished": true,
    "createdAt": "2025-11-16T10:00:00Z",
    "updatedAt": "2025-11-16T10:00:00Z",
    "auditLog": [
      {
        "id": "audit-id",
        "action": "publish",
        "changedBy": "user-id",
        "changedAt": "2025-11-17T08:00:00Z"
      }
    ]
  }
}
```

**Error Responses**:
- `404 ARTICLE_NOT_FOUND`: Article does not exist
- `403 FORBIDDEN`: Article is not visible to this user (private/not published)

---

### POST /api/articles

🔐 **Create a new article**

Create a new article. User must be admin or teacher.

**Request Body**:
```json
{
  "weekNumber": "2025-W47",
  "title": "Article Title",
  "content": "# Markdown content",
  "author": "Ms. Chen",
  "articleOrder": 2,
  "visibilityType": "public|class_restricted",
  "restrictedToClasses": ["A1", "B2"]
}
```

**Validation**:
- `title`: Required, 1-500 characters
- `content`: Required, Markdown format
- `articleOrder`: Required, positive integer, unique per week
- `visibilityType`: Required, must be "public" or "class_restricted"
- `restrictedToClasses`: Required if visibilityType="class_restricted", must contain valid class IDs

**Response** (201 CREATED):
```json
{
  "status": "success",
  "data": {
    "id": "new-uuid",
    "weekNumber": "2025-W47",
    "title": "Article Title",
    "content": "# Markdown content",
    "author": "Ms. Chen",
    "articleOrder": 2,
    "visibilityType": "public",
    "restrictedToClasses": null,
    "isPublished": false,
    "createdBy": "user-id",
    "createdAt": "2025-11-17T10:00:00Z",
    "updatedAt": "2025-11-17T10:00:00Z"
  }
}
```

**Error Responses**:
- `400 BAD_REQUEST`: Invalid article data
- `409 CONFLICT`: Article order already exists for this week
- `403 FORBIDDEN`: User doesn't have permission to create articles
- `404 WEEK_NOT_FOUND`: Week does not exist

---

### PUT /api/articles/{id}

🔐 **Update an article**

Update article content. Only creator, assigned teacher, or admin can edit.

**Request Body** (all fields optional):
```json
{
  "title": "Updated Title",
  "content": "# Updated markdown",
  "author": "New Author",
  "visibilityType": "class_restricted",
  "restrictedToClasses": ["B1"]
}
```

**Response** (200 OK):
```json
{
  "status": "success",
  "data": {
    "id": "uuid-1",
    "weekNumber": "2025-W47",
    "title": "Updated Title",
    "content": "# Updated markdown",
    "author": "New Author",
    "articleOrder": 1,
    "visibilityType": "class_restricted",
    "restrictedToClasses": ["B1"],
    "isPublished": false,
    "createdBy": "user-id",
    "createdAt": "2025-11-16T10:00:00Z",
    "updatedAt": "2025-11-17T10:00:00Z"
  }
}
```

**Error Responses**:
- `400 BAD_REQUEST`: Invalid update data
- `403 FORBIDDEN`: User doesn't have permission to edit this article
- `404 ARTICLE_NOT_FOUND`: Article does not exist
- `409 CONFLICT`: Class IDs are invalid

---

### DELETE /api/articles/{id}

🔐 **Soft-delete an article**

Soft-delete article (marks as deleted but preserves audit trail). Only creator, assigned teacher, or admin can delete.

**Response** (200 OK):
```json
{
  "status": "success",
  "data": {
    "id": "uuid-1",
    "deleted": true,
    "deletedAt": "2025-11-17T10:05:00Z"
  }
}
```

**Error Responses**:
- `403 FORBIDDEN`: User doesn't have permission to delete this article
- `404 ARTICLE_NOT_FOUND`: Article does not exist
- `409 CONFLICT`: Article is already deleted

---

### POST /api/articles/{id}/publish

🔐 **Publish an article**

Mark article as published (visible to readers). Article must be complete and valid.

**Request Body** (empty):
```json
{}
```

**Response** (200 OK):
```json
{
  "status": "success",
  "data": {
    "id": "uuid-1",
    "isPublished": true,
    "publishedAt": "2025-11-17T10:00:00Z",
    "updatedAt": "2025-11-17T10:00:00Z"
  }
}
```

**Error Responses**:
- `403 FORBIDDEN`: User doesn't have permission to publish
- `404 ARTICLE_NOT_FOUND`: Article does not exist
- `409 CONFLICT`: Article is already published

---

### POST /api/articles/{id}/unpublish

🔐 **Unpublish an article**

Mark article as unpublished (invisible to readers). Data is preserved.

**Request Body** (empty):
```json
{}
```

**Response** (200 OK):
```json
{
  "status": "success",
  "data": {
    "id": "uuid-1",
    "isPublished": false,
    "updatedAt": "2025-11-17T10:00:00Z"
  }
}
```

**Error Responses**:
- `403 FORBIDDEN`: User doesn't have permission to unpublish
- `404 ARTICLE_NOT_FOUND`: Article does not exist
- `409 CONFLICT`: Article is already unpublished

---

### POST /api/articles/reorder

🔐 **Batch reorder articles within a week**

Reorder multiple articles in a week. Atomic operation (all-or-nothing).

**Request Body**:
```json
{
  "weekNumber": "2025-W47",
  "articles": [
    { "id": "uuid-1", "articleOrder": 2 },
    { "id": "uuid-2", "articleOrder": 1 },
    { "id": "uuid-3", "articleOrder": 3 }
  ]
}
```

**Response** (200 OK):
```json
{
  "status": "success",
  "data": {
    "weekNumber": "2025-W47",
    "reordered": 3,
    "articles": [
      { "id": "uuid-2", "articleOrder": 1 },
      { "id": "uuid-1", "articleOrder": 2 },
      { "id": "uuid-3", "articleOrder": 3 }
    ]
  }
}
```

**Error Responses**:
- `400 BAD_REQUEST`: Invalid reorder data
- `403 FORBIDDEN`: User doesn't have permission to reorder
- `404 WEEK_NOT_FOUND`: Week does not exist
- `409 CONFLICT`: Article order validation failed

---

## Week Endpoints

### GET /api/weeks/{weekNumber}

🔓 **Get a week with articles**

Fetch week metadata and all published articles for the week.

**Path Parameters**:
```typescript
{
  weekNumber: string  // ISO week format: "2025-W47"
}
```

**Response** (200 OK):
```json
{
  "status": "success",
  "data": {
    "weekNumber": "2025-W47",
    "releaseDate": "2025-11-17",
    "isPublished": true,
    "createdAt": "2025-11-16T10:00:00Z",
    "updatedAt": "2025-11-16T10:00:00Z",
    "articles": [
      {
        "id": "uuid-1",
        "title": "Article 1",
        "articleOrder": 1,
        "isPublished": true
      }
    ],
    "totalArticles": 1
  }
}
```

**Error Responses**:
- `400 BAD_REQUEST`: Invalid week format
- `404 WEEK_NOT_FOUND`: Week does not exist

---

### POST /api/weeks

🔑 **Create a new week**

Create a new newsletter week. Admin-only operation.

**Request Body**:
```json
{
  "weekNumber": "2025-W48",
  "releaseDate": "2025-11-24"
}
```

**Response** (201 CREATED):
```json
{
  "status": "success",
  "data": {
    "weekNumber": "2025-W48",
    "releaseDate": "2025-11-24",
    "isPublished": false,
    "createdAt": "2025-11-17T10:00:00Z",
    "updatedAt": "2025-11-17T10:00:00Z"
  }
}
```

**Error Responses**:
- `400 BAD_REQUEST`: Invalid week data
- `403 FORBIDDEN`: User is not admin
- `409 CONFLICT`: Week already exists

---

### POST /api/weeks/{weekNumber}/publish

🔑 **Publish a week**

Publish all articles in a week (make visible to readers). Admin-only.

**Response** (200 OK):
```json
{
  "status": "success",
  "data": {
    "weekNumber": "2025-W47",
    "isPublished": true,
    "updatedAt": "2025-11-17T10:00:00Z",
    "publishedArticles": 6
  }
}
```

**Error Responses**:
- `403 FORBIDDEN`: User is not admin
- `404 WEEK_NOT_FOUND`: Week does not exist

---

### POST /api/weeks/{weekNumber}/unpublish

🔑 **Unpublish a week**

Unpublish a week (make invisible to readers). Admin-only.

**Response** (200 OK):
```json
{
  "status": "success",
  "data": {
    "weekNumber": "2025-W47",
    "isPublished": false,
    "updatedAt": "2025-11-17T10:00:00Z"
  }
}
```

**Error Responses**:
- `403 FORBIDDEN`: User is not admin
- `404 WEEK_NOT_FOUND`: Week does not exist

---

## Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `BAD_REQUEST` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | User lacks permission |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Conflict with existing data |
| `UNPROCESSABLE_ENTITY` | 422 | Validation error |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |

---

## Rate Limiting

- **Public endpoints**: 100 requests per minute per IP
- **Authenticated endpoints**: 1000 requests per minute per user
- **Admin endpoints**: 10000 requests per minute per user

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1700128000
```

---

## Performance Requirements

| Endpoint | Target | Notes |
|----------|--------|-------|
| GET /api/articles | <500ms | SC-001: <500ms for 100 articles |
| GET /api/articles/{id} | <100ms | Single article fetch |
| POST /api/articles | <1000ms | Includes validation |
| PUT /api/articles/{id} | <1000ms | Includes validation |
| DELETE /api/articles/{id} | <500ms | Soft-delete only |
| POST /api/articles/{id}/publish | <500ms | Status update |
| POST /api/articles/reorder | <2000ms | Batch reorder atomic |
| GET /api/weeks/{weekNumber} | <500ms | Week + articles |
| POST /api/weeks | <1000ms | Validation required |

---

## Implementation Status

- [ ] Article GET endpoints
- [ ] Article POST endpoint
- [ ] Article PUT endpoint
- [ ] Article DELETE endpoint
- [ ] Article publish endpoints
- [ ] Article reorder endpoint
- [ ] Week GET endpoint
- [ ] Week POST endpoint
- [ ] Week publish endpoints
- [ ] Authentication middleware
- [ ] Error handling middleware
- [ ] Rate limiting middleware
- [ ] Request validation
- [ ] Response formatting
- [ ] Logging & monitoring

---

## Related Files

- **Data Model**: [data-model.md](./data-model.md)
- **Database Schema**: [schema.sql](./schema.sql)
- **Quickstart**: [../quickstart.md](../quickstart.md)
- **Type Definitions**: [src/types/database.ts](../../src/types/database.ts)
- **Article Service**: [src/services/ArticleService.ts](../../src/services/ArticleService.ts)
