# Research & Technical Decisions: CMS Database Structure

**Feature**: 002-database-structure
**Phase**: Phase 0 - Research & Clarification
**Date**: 2025-11-17

## Research Overview

This document consolidates technical decisions and research findings to resolve design unknowns identified in the feature specification and user input.

---

## 1. Multi-Class Family Structure

### Problem Statement
Parents can have multiple children in different classes. When viewing a weekly newsletter, they should see articles from all their children's classes, but without receiving duplicate article content if multiple children share the same class.

### Decision: Hierarchical Family-Class Relationship

**Structure**:
- Users have a `user_id` and role (`parent`, `teacher`, `admin`, `student`)
- Families have `family_id` with multiple parent accounts
- Children belong to families and have enrollments in classes
- Classes have a `class_grade_year` attribute (e.g., 1, 2, 3... for primary school years)
- Articles are attached to classes, not individual children

**Rationale**:
- Eliminates data duplication: one article per class, not per child
- Supports family-level viewing: query all classes where family's children are enrolled
- Enables sorting by grade year: display higher grades (older kids) first
- Scales efficiently: N children across M classes requires O(N+M) queries, not O(N×M)

**Alternative Considered**:
- Direct article-to-child attachment would create duplicates and complicate editing

---

## 2. Article Permission Model: Edit vs. Read

### Problem Statement
Articles can be edited by Admins and class Teachers. Articles can be read by all users by default, with class-specific articles restricted to authorized parents and teachers.

### Decision: Two-Layer Permission System

**Edit Permissions** (database-enforced):
- Only Admins or Teachers assigned to the article's class can edit
- Implemented via `article_editor_role` field (check against `creator_role` or editor group table)
- Validation: Application layer checks user role + class assignment before update

**Read Permissions** (application-filtered):
- Default: All published articles readable by public visitors (no auth needed)
- Class articles: Only readable by:
  - Parents with children in the class
  - Teachers assigned to the class
  - Admins
- Implemented via `article_visibility_type` (enum: 'public', 'class_restricted')
- For class-restricted articles, store list of accessible class IDs

**Rationale**:
- Separation of concerns: database stores data; application enforces policies
- Flexibility: permission rules can evolve without schema changes
- Performance: filtering at query time (indexes on visibility_type) is efficient
- Audit trail: all edits tracked with creator_id and timestamp

---

## 3. Week Organization & Sorting

### Problem Statement
Articles are organized by week (ISO format: 2025-W47). Parents viewing with multiple children should see class articles sorted by grade year (descending: higher grades first).

### Decision: Multi-Level Sort with Grade-Year Ordering

**Data Structure**:
- `newsletter_weeks` table with `week_number` (primary key, e.g., "2025-W47")
- `articles` table with `week_number` (FK) + `article_order` (display order within week) + `article_grade_context` (optional: which grade this article targets)
- `classes` table with `class_id` + `class_grade_year` (integer: 1, 2, 3, etc.)
- `class_articles` junction table: maps articles to classes they're visible in

**Sort Logic**:
1. Primary: by `week_number` (newest first)
2. Secondary: by `article_order` within week (editor-specified)
3. Tertiary (for families): by `class_grade_year` descending (older kids' articles first)

**Rationale**:
- Maintains editorial control of article order within a week
- Grade-year sorting respects family structure (show older children's content prominence)
- Allows articles to be shared across multiple classes without duplication
- Query optimization: index on (week_number, article_order) and (class_grade_year DESC)

---

## 4. Soft-Delete & Audit Trail

### Problem Statement
System must support soft-delete (unpublish) to preserve audit trails while removing from public view.

### Decision: Soft-Delete with Timestamp-Based Visibility

**Implementation**:
- Add columns to `articles`:
  - `is_published` (boolean): true if visible, false if unpublished/archived
  - `deleted_at` (nullable timestamp): NULL if active, timestamp if archived
  - `updated_at` (timestamp): auto-updated on every change
- Add audit table `article_audit_log`:
  - Track all changes: creation, edits, deletions
  - Log user, timestamp, change description

**Query Behavior**:
- Public visitors: filter to `is_published = true AND deleted_at IS NULL`
- Editors: see all articles (published and unpublished) for their classes
- Admins: see everything

**Rationale**:
- No permanent data loss: articles remain in database for compliance/audit
- Query flexibility: can undelete articles by resetting `deleted_at`
- Audit trail: `article_audit_log` tracks all modifications for compliance

---

## 5. Class-Article Relationship

### Problem Statement
Articles can be class-restricted (班級大小事) or public. Multiple classes may benefit from the same article content (e.g., general school announcements).

### Decision: Junction Table with Flexibility

**Schema**:
- `articles` table: core article content (title, body, metadata)
- `article_visibility` table:
  - `article_id` (FK)
  - `visibility_type` (enum: 'public', 'class_restricted')
  - `visible_to_classes` (array of class_ids, or FK to class table)
- OR simpler: Store visibility directly in articles:
  - `visibility_type` (enum)
  - `restricted_to_classes` (jsonb array of class_ids)

**Rationale** (simpler approach chosen):
- Most articles are either public OR class-restricted, not both
- Avoids excessive JOINs for common queries
- PostgreSQL JSONB supports efficient indexing on array contents

---

## 6. Performance Optimization

### Query Patterns

**Pattern A: Visitor fetches public articles for a week**
```
SELECT * FROM articles
WHERE week_number = '2025-W47'
  AND is_published = true
  AND deleted_at IS NULL
  AND visibility_type = 'public'
ORDER BY article_order ASC
```
**Index**: (week_number, is_published, deleted_at, visibility_type, article_order)

**Pattern B: Parent fetches articles for all their children's classes**
```
SELECT DISTINCT a.* FROM articles a
JOIN class_articles ca ON a.id = ca.article_id
JOIN classes c ON ca.class_id = c.id
WHERE a.week_number = '2025-W47'
  AND a.is_published = true
  AND a.deleted_at IS NULL
  AND (a.visibility_type = 'public' OR c.class_id IN (parent_class_list))
ORDER BY c.class_grade_year DESC, a.article_order ASC
```
**Indexes**:
- (week_number, is_published, deleted_at) on articles
- (class_grade_year DESC) on classes
- (article_id, class_id) on class_articles

---

## 7. Technology Stack Confirmation

**Database**: PostgreSQL (via Supabase)
- Rationale: Recommended in PROJECT_CONSTITUTION, supports JSON, full-text search, row-level security
- No exotic extensions needed; standard SQL features sufficient

**ORM/Query Layer**: Supabase (direct SQL) or PostgREST
- Rationale: Auto-generates REST endpoints from schema
- For complex queries, direct SQL with Supabase JavaScript client

**Testing**:
- Unit tests: Query builders with test fixtures
- Integration tests: Supabase test database
- Load tests: Simulate 100+ articles/week, parallel requests

---

## Research Outcomes

### ✅ All Design Decisions Resolved

| Decision | Status | Rationale |
|----------|--------|-----------|
| Family-class hierarchy | ✅ Finalized | Eliminates duplicates, efficient querying |
| Edit vs. read permissions | ✅ Finalized | Two-layer system (DB + app) |
| Multi-class parent viewing | ✅ Finalized | Grade-year sorting with junction table |
| Soft-delete implementation | ✅ Finalized | Audit trail + compliance |
| Class-article relationship | ✅ Finalized | JSONB for simplicity |
| Performance optimization | ✅ Finalized | Indexed queries target <500ms |
| Technology stack | ✅ Confirmed | PostgreSQL + Supabase |

### Next Steps

Proceed to **Phase 1: Design & Contracts**
- Generate `data-model.md` with entity definitions and relationships
- Create OpenAPI/SQL contracts in `/contracts/`
- Develop `quickstart.md` with database initialization scripts
