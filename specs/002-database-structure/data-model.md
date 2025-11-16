# Data Model: CMS Database Structure

**Feature**: 002-database-structure
**Phase**: Phase 1 - Design & Contracts
**Date**: 2025-11-17

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      CORE ENTITIES                          │
└─────────────────────────────────────────────────────────────┘

newsletter_weeks (週次)
  - week_number (PK, ISO format: "2025-W47")
  - release_date (DATE)
  - is_published (BOOLEAN)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
       ↑
       │ 1:N
       ├── articles (文章)
       │    - id (PK, UUID)
       │    - week_number (FK)
       │    - title (TEXT)
       │    - content (TEXT - Markdown)
       │    - author (TEXT)
       │    - article_order (INTEGER)
       │    - is_published (BOOLEAN)
       │    - visibility_type (ENUM: 'public' | 'class_restricted')
       │    - restricted_to_classes (JSONB array)
       │    - created_by (UUID - user_id)
       │    - created_at (TIMESTAMP)
       │    - updated_at (TIMESTAMP)
       │    - deleted_at (TIMESTAMP, nullable)
       │
       └─────────────────────────────┐
                                      │ N:M (class_articles)
                                      │
                                   classes (班級)
                                      - id (PK, VARCHAR: "A1", "B2", etc.)
                                      - class_name (TEXT)
                                      - class_grade_year (INTEGER: 1-6)
                                      - created_at (TIMESTAMP)

┌─────────────────────────────────────────────────────────────┐
│                    ACCESS CONTROL                           │
└─────────────────────────────────────────────────────────────┘

users (使用者)
  - id (PK, UUID)
  - email (UNIQUE, VARCHAR)
  - role (ENUM: 'admin' | 'teacher' | 'parent' | 'student')
  - created_at (TIMESTAMP)
       │
       ├─→ teacher_class_assignment (教師班級分派)
       │    - teacher_id (FK: users.id)
       │    - class_id (FK: classes.id)
       │    - assigned_at (TIMESTAMP)
       │
       └─→ family_enrollment (家庭成員)
            - family_id (FK: families.id)
            - child_id (FK: users.id)
            - relationship (ENUM: 'father' | 'mother' | 'guardian')
            - enrolled_at (TIMESTAMP)

families (家庭)
  - id (PK, UUID)
  - family_code (UNIQUE, VARCHAR)
  - created_at (TIMESTAMP)
       │
       └─→ child_class_enrollment (兒童班級註冊)
            - child_id (FK: users.id)
            - class_id (FK: classes.id)
            - enrolled_at (TIMESTAMP)
            - graduated_at (TIMESTAMP, nullable)

┌─────────────────────────────────────────────────────────────┐
│                    AUDIT & TRACKING                         │
└─────────────────────────────────────────────────────────────┘

article_audit_log (文章審計日誌)
  - id (PK, UUID)
  - article_id (FK: articles.id)
  - action (ENUM: 'create' | 'update' | 'publish' | 'unpublish' | 'delete')
  - changed_by (FK: users.id)
  - old_values (JSONB)
  - new_values (JSONB)
  - changed_at (TIMESTAMP)
```

---

## Detailed Entity Definitions

### 1. `newsletter_weeks` (週次)

**Purpose**: Weekly newsletter container and metadata

**Fields**:
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `week_number` | VARCHAR(10) | PRIMARY KEY, UNIQUE | Format: "YYYY-Www" (e.g., "2025-W47") |
| `release_date` | DATE | NOT NULL | Expected publication date |
| `is_published` | BOOLEAN | DEFAULT false | Controls visibility to public |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Auto-generated |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Auto-updated on changes |

**Relationships**:
- 1:N with `articles` (one week contains many articles)

**Validation**:
- `week_number` must match ISO 8601 format
- `release_date` should be a Monday of that week
- `is_published = false` articles are still editable

---

### 2. `articles` (文章)

**Purpose**: Individual article content, metadata, and visibility control

**Fields**:
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| `week_number` | VARCHAR(10) | FOREIGN KEY → newsletter_weeks, NOT NULL | Reference to parent week |
| `title` | TEXT | NOT NULL, MAX 200 chars | Article headline |
| `content` | TEXT | NOT NULL | Markdown-formatted content |
| `author` | VARCHAR(100) | | Author name (optional, may differ from creator) |
| `article_order` | INTEGER | NOT NULL | Display sequence within week (1, 2, 3...) |
| `is_published` | BOOLEAN | DEFAULT false | Public visibility flag |
| `visibility_type` | ENUM | DEFAULT 'public', CHECK (visibility_type IN ('public', 'class_restricted')) | Public or class-restricted |
| `restricted_to_classes` | JSONB | | Array of class IDs if `visibility_type = 'class_restricted'` |
| `created_by` | UUID | FOREIGN KEY → users.id | Creator user ID |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last modification timestamp |
| `deleted_at` | TIMESTAMP | NULLABLE | Soft-delete marker (NULL = active) |

**Relationships**:
- N:1 with `newsletter_weeks` (many articles per week)
- N:M with `classes` via `class_articles` (articles visible to multiple classes)

**Validation**:
- `article_order` must be unique per `(week_number, article_order)` pair
- If `visibility_type = 'class_restricted'`, `restricted_to_classes` MUST NOT be empty
- `created_by` must reference a valid user with role 'admin' or 'teacher'
- Only `created_by` (or admin) can edit articles
- `updated_at` auto-updates on any change (via trigger)

**State Transitions**:
```
Draft (is_published=false)
  ↓ [editor publishes]
Published (is_published=true, deleted_at=NULL)
  ↓ [editor unpublishes/deletes]
Archived (is_published=false, deleted_at=NOW())
  ↓ [admin restores]
Published (deleted_at=NULL, is_published=true)
```

---

### 3. `classes` (班級)

**Purpose**: School classes and grade-level organization

**Fields**:
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | VARCHAR(10) | PRIMARY KEY | Class identifier (e.g., "A1", "B2") |
| `class_name` | TEXT | NOT NULL | Human-readable name (e.g., "Grade 1A") |
| `class_grade_year` | INTEGER | NOT NULL, CHECK (class_grade_year BETWEEN 1 AND 12) | Grade level (1=first year primary) |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | |

**Relationships**:
- 1:N with `teacher_class_assignment` (a class has many assigned teachers)
- 1:N with `child_class_enrollment` (a class has many enrolled children)

---

### 4. `users` (使用者)

**Purpose**: System users with role-based permissions

**Fields**:
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY, from Supabase auth.users | |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | |
| `role` | ENUM | CHECK (role IN ('admin', 'teacher', 'parent', 'student')) | Determines permissions |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | |

**Relationships**:
- 1:N with `articles` via `created_by` (creator tracking)
- 1:N with `teacher_class_assignment` (teachers assigned to classes)
- 1:N with `family_enrollment` (parents belong to families)
- 1:N with `article_audit_log` (audit trail)

---

### 5. `families` (家庭)

**Purpose**: Group parents and children for multi-class family viewing

**Fields**:
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | |
| `family_code` | VARCHAR(20) | UNIQUE | Enrollment code for parents to join |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | |

**Relationships**:
- 1:N with `family_enrollment` (parents in family)
- 1:N with `child_class_enrollment` (children in family)

---

### 6. `family_enrollment` (家庭成員)

**Purpose**: Link parents to families

**Fields**:
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | |
| `family_id` | UUID | FOREIGN KEY → families.id, NOT NULL | |
| `parent_id` | UUID | FOREIGN KEY → users.id (role='parent'), NOT NULL | |
| `relationship` | ENUM | CHECK (relationship IN ('father', 'mother', 'guardian')) | Family role |
| `enrolled_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | |

**Unique Constraint**: (family_id, parent_id)

---

### 7. `child_class_enrollment` (兒童班級註冊)

**Purpose**: Link children to classes they're enrolled in

**Fields**:
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | |
| `child_id` | UUID | FOREIGN KEY → users.id (role='student'), NOT NULL | |
| `family_id` | UUID | FOREIGN KEY → families.id, NOT NULL | Links back to family |
| `class_id` | VARCHAR(10) | FOREIGN KEY → classes.id, NOT NULL | |
| `enrolled_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | |
| `graduated_at` | TIMESTAMP | NULLABLE | NULL = still enrolled, timestamp = graduated |

**Unique Constraint**: (child_id, class_id) while `graduated_at IS NULL`

---

### 8. `teacher_class_assignment` (教師班級分派)

**Purpose**: Assign teachers to classes (edit permissions)

**Fields**:
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | |
| `teacher_id` | UUID | FOREIGN KEY → users.id (role='teacher'), NOT NULL | |
| `class_id` | VARCHAR(10) | FOREIGN KEY → classes.id, NOT NULL | |
| `assigned_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | |

**Unique Constraint**: (teacher_id, class_id)

---

### 9. `article_audit_log` (文章審計日誌)

**Purpose**: Complete audit trail of article modifications

**Fields**:
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | |
| `article_id` | UUID | FOREIGN KEY → articles.id, NOT NULL | |
| `action` | ENUM | CHECK (action IN ('create', 'update', 'publish', 'unpublish', 'delete')) | |
| `changed_by` | UUID | FOREIGN KEY → users.id, NOT NULL | Who made the change |
| `old_values` | JSONB | | Previous field values (for updates) |
| `new_values` | JSONB | | New field values |
| `changed_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | |

---

## Key Constraints & Validations

### Uniqueness Constraints
- `newsletter_weeks.week_number` (primary key)
- `articles.(week_number, article_order)` (unique per week)
- `classes.id` (primary key)
- `families.family_code` (unique enrollment code)
- `teacher_class_assignment.(teacher_id, class_id)` (one assignment per teacher-class pair)
- `child_class_enrollment.(child_id, class_id)` while active (no duplicate enrollments)

### Foreign Key Constraints
- `articles.week_number` → `newsletter_weeks.week_number` (ON DELETE CASCADE - delete articles when week is deleted)
- `articles.created_by` → `users.id` (ON DELETE SET NULL - preserve audit trail)
- All `_id` foreign keys: ON DELETE RESTRICT (prevent orphaned records)

### Check Constraints
- `articles.visibility_type` IN ('public', 'class_restricted')
- `classes.class_grade_year` BETWEEN 1 AND 12
- `users.role` IN ('admin', 'teacher', 'parent', 'student')
- `family_enrollment.relationship` IN ('father', 'mother', 'guardian')
- `article_audit_log.action` IN ('create', 'update', 'publish', 'unpublish', 'delete')

---

## Indexes for Performance

**Critical Indexes** (SC-001: <500ms retrieval):
```sql
-- Week + publication status (common query)
CREATE INDEX idx_articles_week_published
  ON articles(week_number, is_published, deleted_at, visibility_type);

-- Article ordering within week
CREATE INDEX idx_articles_order
  ON articles(week_number, article_order);

-- Class visibility lookups
CREATE INDEX idx_classes_grade_year
  ON classes(class_grade_year DESC);

-- User assignments (for permission checking)
CREATE INDEX idx_teacher_assignment_teacher
  ON teacher_class_assignment(teacher_id);

CREATE INDEX idx_child_enrollment_child
  ON child_class_enrollment(child_id, graduated_at);

-- Audit trail queries
CREATE INDEX idx_audit_article_date
  ON article_audit_log(article_id, changed_at DESC);
```

---

## Row-Level Security (RLS) Policies

**Planned RLS Rules** (implemented in Supabase):

1. **Articles**: Published public articles readable by all; class-restricted articles readable only by enrolled parents/teachers
2. **Classes**: All users can read class info; only admins can modify
3. **Users**: Users can read own profile; admins can read all
4. **Audit Log**: Readable by admins only; write-only (prevent tampering)

---

## Assumptions & Design Decisions

1. **No authentication layer in schema**: User roles come from Supabase auth; schema doesn't enforce auth, application does
2. **JSONB for `restricted_to_classes`**: Simpler than separate junction table for most use cases; can be refactored later if needed
3. **Soft-delete instead of hard delete**: Preserves audit trail and allows recovery
4. **No article versioning in core schema**: Audit log captures old/new values; full version history available if needed
5. **Grade year as integer**: Allows sorting and range queries; maps to school year levels

---

## Next Steps

1. Generate SQL migration scripts in `/contracts/`
2. Create quickstart guide with sample data
3. Develop integration tests for queries
