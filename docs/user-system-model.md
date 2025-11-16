# User System Model Design

## Overview

This document outlines the complete user system model for the Email CMS application, supporting a Waldorf education environment where:
- **Admins** manage the entire system
- **Class Teachers** manage their class content and students
- **Parents** can only view content related to their children's classes
- **Students** can view their own class content

## 1. Core Models

### 1.1 User Model

```typescript
interface User {
  id: string;                    // UUID
  email: string;                 // Unique, required for login
  passwordHash: string;          // Hashed password (bcrypt/argon2)
  role: UserRole;                // Single role per user
  firstName: string;
  lastName: string;
  displayName?: string;          // Optional display name
  avatar?: string;               // URL to avatar image
  phoneNumber?: string;          // Contact number
  isActive: boolean;             // Account status
  emailVerified: boolean;        // Email verification status
  lastLoginAt?: string;          // ISO timestamp
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}

enum UserRole {
  ADMIN = 'ADMIN',               // Full system access
  CLASS_TEACHER = 'CLASS_TEACHER', // Manage assigned classes
  PARENT = 'PARENT',             // View children's class content
  STUDENT = 'STUDENT'            // View own class content
}
```

**Notes:**
- Each user has exactly ONE role
- Email is the primary login identifier
- Password is hashed using bcrypt or argon2
- `isActive` allows for account deactivation without deletion

### 1.2 Class Model

```typescript
interface Class {
  id: string;                    // UUID
  name: string;                  // e.g., "Grade 1A", "一年級甲班"
  grade: number;                 // 1-12 (or K for kindergarten = 0)
  section?: string;              // e.g., "A", "B", "甲", "乙"
  academicYear: string;          // e.g., "2024-2025"
  description?: string;          // Optional class description
  teacherId: string;             // Foreign key to User (CLASS_TEACHER)
  isActive: boolean;             // Active status
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}
```

**Notes:**
- Each class has ONE primary teacher
- Classes are tied to an academic year
- `isActive` allows archiving old classes

### 1.3 Student-Class Relationship (Class Membership)

```typescript
interface ClassMembership {
  id: string;                    // UUID
  studentId: string;             // Foreign key to User (STUDENT)
  classId: string;               // Foreign key to Class
  enrollmentDate: string;        // ISO timestamp
  status: MembershipStatus;      // Current enrollment status
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}

enum MembershipStatus {
  ACTIVE = 'ACTIVE',             // Currently enrolled
  TRANSFERRED = 'TRANSFERRED',   // Moved to another class
  WITHDRAWN = 'WITHDRAWN',       // No longer at school
  GRADUATED = 'GRADUATED'        // Completed the grade
}
```

**Notes:**
- A student can be in multiple classes (e.g., main class + special subjects)
- Historical memberships are preserved (not deleted)
- Use `status` to track current enrollment

### 1.4 Family Relationship Model

```typescript
interface FamilyRelationship {
  id: string;                    // UUID
  parentId: string;              // Foreign key to User (PARENT)
  studentId: string;             // Foreign key to User (STUDENT)
  relationshipType: RelationType; // Type of relationship
  isPrimaryContact: boolean;     // Is this the primary parent/guardian?
  canReceiveUpdates: boolean;    // Can receive email/notifications
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}

enum RelationType {
  MOTHER = 'MOTHER',
  FATHER = 'FATHER',
  GUARDIAN = 'GUARDIAN',
  STEPMOTHER = 'STEPMOTHER',
  STEPFATHER = 'STEPFATHER',
  GRANDPARENT = 'GRANDPARENT',
  OTHER = 'OTHER'
}
```

**Notes:**
- One student can have multiple parents/guardians
- One parent can have multiple children
- `isPrimaryContact` designates main contact for school communications
- Supports various family structures (single parent, guardians, etc.)

### 1.5 Enhanced Article Model

```typescript
interface Article {
  id: string;                    // UUID or incrementing ID
  title: string;                 // Required
  content: string;               // Markdown format
  author?: string;               // Optional author name
  authorId?: string;             // Foreign key to User (who created)
  summary?: string;              // Optional summary
  weekNumber: string;            // ISO 8601 format (e.g., "2025-W43")

  // Class-specific article support
  classId?: string;              // Foreign key to Class (null = all-school)
  articleType: ArticleType;      // Type of article

  order: number;                 // Position in week (1, 2, 3...)
  slug?: string;                 // URL-friendly name
  publicUrl: string;             // Public accessible URL

  createdAt: string;
  updatedAt: string;
  publishedAt?: string;          // Optional
  isPublished: boolean;
  viewCount?: number;            // Analytics
}

enum ArticleType {
  ALL_SCHOOL = 'ALL_SCHOOL',     // Visible to everyone
  CLASS_NEWS = 'CLASS_NEWS',     // 班級大小事 - class-specific
  ANNOUNCEMENT = 'ANNOUNCEMENT',  // School-wide announcement
  EVENT = 'EVENT'                // Event information
}
```

**Notes:**
- `classId = null` means article is visible to all users
- `classId` set means article is only for that specific class
- `articleType = CLASS_NEWS` represents "班級大小事"
- `authorId` links to the user who created the article

## 2. Relationships & Constraints

### 2.1 Entity Relationship Diagram

```
┌─────────────────────┐
│       User          │
│  - id (PK)         │
│  - email (UNIQUE)  │
│  - role            │
│  - firstName       │
│  - lastName        │
└──────┬──────────────┘
       │
       │ 1
       │
       ├─────────────────────────────────────────┐
       │                                         │
       │ N                                       │ N
┌──────▼──────────────┐                 ┌────────▼─────────────┐
│ ClassMembership     │                 │ FamilyRelationship   │
│  - id (PK)         │                 │  - id (PK)          │
│  - studentId (FK)  │◄────────────────┤  - parentId (FK)    │
│  - classId (FK)    │        1:N      │  - studentId (FK)   │
│  - status          │                 │  - relationshipType │
└──────┬──────────────┘                 └─────────────────────┘
       │
       │ N
       │
       │ 1
┌──────▼──────────────┐
│      Class          │
│  - id (PK)         │
│  - name            │
│  - teacherId (FK)  │──────┐
│  - academicYear    │      │ 1
└──────┬──────────────┘      │
       │                     │
       │ 1                   │
       │                     │
       │ N                   │ N
┌──────▼──────────────┐      │
│     Article         │      │
│  - id (PK)         │      │
│  - classId (FK)    │      │
│  - authorId (FK)   ├──────┘
│  - articleType     │
│  - weekNumber      │
└─────────────────────┘
```

### 2.2 Database Constraints

**User Table:**
- `email` must be UNIQUE
- `email` must be valid email format
- `role` must be one of UserRole enum
- `passwordHash` must not be null

**Class Table:**
- `teacherId` must reference valid User with role = CLASS_TEACHER
- `name` + `academicYear` should be unique (composite constraint)
- `grade` must be 0-12

**ClassMembership Table:**
- `studentId` must reference valid User with role = STUDENT
- `classId` must reference valid Class
- Unique constraint on (studentId, classId, status='ACTIVE') - student can only be ACTIVE in a class once
- `status` must be one of MembershipStatus enum

**FamilyRelationship Table:**
- `parentId` must reference valid User with role = PARENT
- `studentId` must reference valid User with role = STUDENT
- Unique constraint on (parentId, studentId) - prevents duplicate relationships
- At least one parent should have `isPrimaryContact = true` per student (application logic)

**Article Table:**
- If `articleType = CLASS_NEWS`, then `classId` must NOT be null
- If `articleType = ALL_SCHOOL`, then `classId` should be null
- `authorId` should reference valid User (if set)
- `weekNumber` must follow ISO 8601 week format

## 3. Permission System

### 3.1 Permission Matrix

| Role | Can View All-School Articles | Can View Class Articles | Can Create/Edit Articles | Can Manage Users | Can Manage Classes |
|------|------------------------------|-------------------------|--------------------------|------------------|--------------------|
| **ADMIN** | ✅ All | ✅ All classes | ✅ All | ✅ Yes | ✅ Yes |
| **CLASS_TEACHER** | ✅ All | ✅ Own class(es) only | ✅ Own class only | ❌ No | ❌ No (view only) |
| **PARENT** | ✅ All | ✅ Children's classes only | ❌ No | ❌ No | ❌ No |
| **STUDENT** | ✅ All | ✅ Own class only | ❌ No | ❌ No | ❌ No |

### 3.2 Article Access Rules

#### Rule 1: All-School Articles
```typescript
// Anyone can view all-school articles
function canViewAllSchoolArticle(user: User, article: Article): boolean {
  return article.articleType === 'ALL_SCHOOL' || article.classId === null;
}
```

#### Rule 2: Class-Specific Articles (班級大小事)
```typescript
function canViewClassArticle(user: User, article: Article): Promise<boolean> {
  // Article must have a classId
  if (!article.classId) return true; // Treat as all-school

  switch (user.role) {
    case UserRole.ADMIN:
      // Admins can view all articles
      return true;

    case UserRole.CLASS_TEACHER:
      // Teachers can view articles from classes they teach
      const teacherClasses = await getClassesByTeacher(user.id);
      return teacherClasses.some(c => c.id === article.classId);

    case UserRole.PARENT:
      // Parents can view articles from their children's classes
      const children = await getChildrenByParent(user.id);
      const childrenClassIds = await getClassIdsByStudents(children.map(c => c.id));
      return childrenClassIds.includes(article.classId);

    case UserRole.STUDENT:
      // Students can view articles from their own classes
      const studentClassIds = await getClassIdsByStudent(user.id);
      return studentClassIds.includes(article.classId);

    default:
      return false;
  }
}
```

#### Rule 3: Create/Edit Articles
```typescript
function canEditArticle(user: User, article: Article): Promise<boolean> {
  switch (user.role) {
    case UserRole.ADMIN:
      // Admins can edit all articles
      return true;

    case UserRole.CLASS_TEACHER:
      // Teachers can edit articles for their own classes
      if (!article.classId) return false; // Can't edit all-school articles
      const teacherClasses = await getClassesByTeacher(user.id);
      return teacherClasses.some(c => c.id === article.classId);

    default:
      return false;
  }
}
```

### 3.3 Implementation Strategy

**Option 1: Row-Level Security (RLS) with PostgreSQL**
```sql
-- Enable RLS on Article table
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Policy for viewing articles
CREATE POLICY article_view_policy ON articles
  FOR SELECT
  USING (
    -- All-school articles are public
    article_type = 'ALL_SCHOOL'
    OR
    -- Admins see everything
    (SELECT role FROM users WHERE id = auth.uid()) = 'ADMIN'
    OR
    -- Teachers see their class articles
    (
      (SELECT role FROM users WHERE id = auth.uid()) = 'CLASS_TEACHER'
      AND class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
    )
    OR
    -- Parents see their children's class articles
    (
      (SELECT role FROM users WHERE id = auth.uid()) = 'PARENT'
      AND class_id IN (
        SELECT cm.class_id
        FROM class_memberships cm
        JOIN family_relationships fr ON cm.student_id = fr.student_id
        WHERE fr.parent_id = auth.uid() AND cm.status = 'ACTIVE'
      )
    )
    OR
    -- Students see their own class articles
    (
      (SELECT role FROM users WHERE id = auth.uid()) = 'STUDENT'
      AND class_id IN (
        SELECT class_id FROM class_memberships
        WHERE student_id = auth.uid() AND status = 'ACTIVE'
      )
    )
  );
```

**Option 2: Application-Layer Permissions (Node.js/Express)**
```typescript
// Middleware to filter articles based on user permissions
async function filterArticlesByPermission(
  articles: Article[],
  user: User
): Promise<Article[]> {
  if (user.role === UserRole.ADMIN) {
    return articles; // Admins see everything
  }

  const accessibleClassIds = await getAccessibleClassIds(user);

  return articles.filter(article => {
    // All-school articles are visible to everyone
    if (article.articleType === 'ALL_SCHOOL' || !article.classId) {
      return true;
    }

    // Check if user has access to this class
    return accessibleClassIds.includes(article.classId);
  });
}

async function getAccessibleClassIds(user: User): Promise<string[]> {
  switch (user.role) {
    case UserRole.CLASS_TEACHER:
      return await db.classes
        .where('teacher_id', user.id)
        .pluck('id');

    case UserRole.PARENT:
      return await db.classMemberships
        .join('family_relationships', 'class_memberships.student_id', 'family_relationships.student_id')
        .where('family_relationships.parent_id', user.id)
        .where('class_memberships.status', 'ACTIVE')
        .pluck('class_memberships.class_id');

    case UserRole.STUDENT:
      return await db.classMemberships
        .where('student_id', user.id)
        .where('status', 'ACTIVE')
        .pluck('class_id');

    default:
      return [];
  }
}
```

## 4. Database Schema (SQL)

### 4.1 PostgreSQL Schema

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
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

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Class table
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  grade INTEGER NOT NULL CHECK (grade >= 0 AND grade <= 12),
  section VARCHAR(10),
  academic_year VARCHAR(20) NOT NULL,
  description TEXT,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_class_per_year UNIQUE (name, academic_year)
);

-- Create indexes
CREATE INDEX idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX idx_classes_academic_year ON classes(academic_year);
CREATE INDEX idx_classes_is_active ON classes(is_active);

-- Class membership table
CREATE TABLE class_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  enrollment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) NOT NULL CHECK (status IN ('ACTIVE', 'TRANSFERRED', 'WITHDRAWN', 'GRADUATED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_active_membership UNIQUE (student_id, class_id, status)
);

-- Create indexes
CREATE INDEX idx_class_memberships_student_id ON class_memberships(student_id);
CREATE INDEX idx_class_memberships_class_id ON class_memberships(class_id);
CREATE INDEX idx_class_memberships_status ON class_memberships(status);

-- Family relationship table
CREATE TABLE family_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL CHECK (
    relationship_type IN ('MOTHER', 'FATHER', 'GUARDIAN', 'STEPMOTHER', 'STEPFATHER', 'GRANDPARENT', 'OTHER')
  ),
  is_primary_contact BOOLEAN DEFAULT false,
  can_receive_updates BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_parent_student UNIQUE (parent_id, student_id)
);

-- Create indexes
CREATE INDEX idx_family_relationships_parent_id ON family_relationships(parent_id);
CREATE INDEX idx_family_relationships_student_id ON family_relationships(student_id);
CREATE INDEX idx_family_relationships_is_primary ON family_relationships(is_primary_contact);

-- Article table (enhanced)
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  author VARCHAR(200),
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  summary TEXT,
  week_number VARCHAR(20) NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  article_type VARCHAR(50) NOT NULL CHECK (
    article_type IN ('ALL_SCHOOL', 'CLASS_NEWS', 'ANNOUNCEMENT', 'EVENT')
  ),
  "order" INTEGER NOT NULL,
  slug VARCHAR(200),
  public_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,
  is_published BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  CONSTRAINT class_news_must_have_class CHECK (
    (article_type = 'CLASS_NEWS' AND class_id IS NOT NULL) OR
    (article_type != 'CLASS_NEWS')
  )
);

-- Create indexes
CREATE INDEX idx_articles_week_number ON articles(week_number);
CREATE INDEX idx_articles_class_id ON articles(class_id);
CREATE INDEX idx_articles_author_id ON articles(author_id);
CREATE INDEX idx_articles_article_type ON articles(article_type);
CREATE INDEX idx_articles_is_published ON articles(is_published);
CREATE INDEX idx_articles_published_at ON articles(published_at);

-- Newsletter weeks table (existing)
CREATE TABLE newsletter_weeks (
  week_number VARCHAR(20) PRIMARY KEY,
  release_date TIMESTAMP WITH TIME ZONE NOT NULL,
  title VARCHAR(500),
  article_ids TEXT[], -- Array of article IDs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_published BOOLEAN DEFAULT false,
  total_articles INTEGER DEFAULT 0
);

-- Create indexes
CREATE INDEX idx_newsletter_weeks_release_date ON newsletter_weeks(release_date);
CREATE INDEX idx_newsletter_weeks_is_published ON newsletter_weeks(is_published);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_class_memberships_updated_at BEFORE UPDATE ON class_memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_family_relationships_updated_at BEFORE UPDATE ON family_relationships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_newsletter_weeks_updated_at BEFORE UPDATE ON newsletter_weeks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 4.2 Sample Data

```sql
-- Insert sample admin user
INSERT INTO users (email, password_hash, role, first_name, last_name, display_name, is_active, email_verified)
VALUES
  ('admin@school.com', '$2b$10$...', 'ADMIN', 'Admin', 'User', 'School Admin', true, true);

-- Insert sample teacher
INSERT INTO users (email, password_hash, role, first_name, last_name, display_name, is_active, email_verified)
VALUES
  ('teacher1@school.com', '$2b$10$...', 'CLASS_TEACHER', '王', '老師', '王老師', true, true);

-- Insert sample class
INSERT INTO classes (name, grade, section, academic_year, teacher_id, is_active)
VALUES
  ('一年級甲班', 1, '甲', '2024-2025', (SELECT id FROM users WHERE email = 'teacher1@school.com'), true);

-- Insert sample students
INSERT INTO users (email, password_hash, role, first_name, last_name, is_active, email_verified)
VALUES
  ('student1@school.com', '$2b$10$...', 'STUDENT', '小明', '陳', true, true),
  ('student2@school.com', '$2b$10$...', 'STUDENT', '小華', '林', true, true);

-- Insert sample parents
INSERT INTO users (email, password_hash, role, first_name, last_name, is_active, email_verified)
VALUES
  ('parent1@example.com', '$2b$10$...', 'PARENT', '大明', '陳', true, true),
  ('parent2@example.com', '$2b$10$...', 'PARENT', '美玲', '陳', true, true);

-- Link students to class
INSERT INTO class_memberships (student_id, class_id, status)
VALUES
  ((SELECT id FROM users WHERE email = 'student1@school.com'),
   (SELECT id FROM classes WHERE name = '一年級甲班'),
   'ACTIVE'),
  ((SELECT id FROM users WHERE email = 'student2@school.com'),
   (SELECT id FROM classes WHERE name = '一年級甲班'),
   'ACTIVE');

-- Link parents to students
INSERT INTO family_relationships (parent_id, student_id, relationship_type, is_primary_contact)
VALUES
  ((SELECT id FROM users WHERE email = 'parent1@example.com'),
   (SELECT id FROM users WHERE email = 'student1@school.com'),
   'FATHER', true),
  ((SELECT id FROM users WHERE email = 'parent2@example.com'),
   (SELECT id FROM users WHERE email = 'student1@school.com'),
   'MOTHER', false);

-- Insert sample class article
INSERT INTO articles (
  title, content, author, author_id, week_number,
  class_id, article_type, "order", public_url, is_published
)
VALUES
  ('本週班級活動', '本週我們進行了戶外教學...', '王老師',
   (SELECT id FROM users WHERE email = 'teacher1@school.com'),
   '2025-W43',
   (SELECT id FROM classes WHERE name = '一年級甲班'),
   'CLASS_NEWS', 1, '/articles/class-news-1', true);

-- Insert sample all-school article
INSERT INTO articles (
  title, content, author, author_id, week_number,
  article_type, "order", public_url, is_published
)
VALUES
  ('全校通知：校慶活動', '下週將舉行校慶活動...', 'School Admin',
   (SELECT id FROM users WHERE email = 'admin@school.com'),
   '2025-W43',
   'ALL_SCHOOL', 2, '/articles/school-announcement-1', true);
```

## 5. API Endpoints Design

### 5.1 Authentication Endpoints

```typescript
POST   /api/auth/login
  Body: { email: string, password: string }
  Returns: { token: string, user: User }

POST   /api/auth/logout
  Headers: { Authorization: Bearer <token> }
  Returns: { success: boolean }

POST   /api/auth/refresh
  Body: { refreshToken: string }
  Returns: { token: string }

GET    /api/auth/me
  Headers: { Authorization: Bearer <token> }
  Returns: { user: User }
```

### 5.2 User Management Endpoints

```typescript
GET    /api/users
  Query: ?role=PARENT&limit=20&offset=0
  Permissions: ADMIN only
  Returns: { users: User[], total: number }

GET    /api/users/:id
  Permissions: ADMIN or self
  Returns: { user: User }

POST   /api/users
  Permissions: ADMIN only
  Body: { email, password, role, firstName, lastName, ... }
  Returns: { user: User }

PATCH  /api/users/:id
  Permissions: ADMIN or self (limited fields)
  Body: { firstName?, lastName?, ... }
  Returns: { user: User }

DELETE /api/users/:id
  Permissions: ADMIN only
  Returns: { success: boolean }
```

### 5.3 Class Management Endpoints

```typescript
GET    /api/classes
  Query: ?academicYear=2024-2025&isActive=true
  Permissions: All authenticated users
  Returns: { classes: Class[], total: number }

GET    /api/classes/:id
  Permissions: All authenticated users
  Returns: { class: Class }

POST   /api/classes
  Permissions: ADMIN only
  Body: { name, grade, section, academicYear, teacherId, ... }
  Returns: { class: Class }

PATCH  /api/classes/:id
  Permissions: ADMIN only
  Body: { name?, teacherId?, ... }
  Returns: { class: Class }

GET    /api/classes/:id/students
  Permissions: ADMIN, CLASS_TEACHER (own class), PARENT (children's class)
  Returns: { students: User[], total: number }

GET    /api/classes/:id/articles
  Permissions: Based on article permission rules
  Query: ?weekNumber=2025-W43
  Returns: { articles: Article[], total: number }
```

### 5.4 Family Relationship Endpoints

```typescript
GET    /api/families/my-children
  Permissions: PARENT only
  Returns: { children: User[] }

GET    /api/families/student/:studentId/parents
  Permissions: ADMIN, CLASS_TEACHER, or parent of student
  Returns: { parents: User[] }

POST   /api/families
  Permissions: ADMIN only
  Body: { parentId, studentId, relationshipType, isPrimaryContact }
  Returns: { relationship: FamilyRelationship }

DELETE /api/families/:id
  Permissions: ADMIN only
  Returns: { success: boolean }
```

### 5.5 Article Endpoints (Enhanced)

```typescript
GET    /api/articles
  Query: ?weekNumber=2025-W43&classId=xxx&articleType=CLASS_NEWS
  Permissions: Based on article permission rules
  Returns: { articles: Article[], total: number }
  Note: Automatically filters based on user's permissions

GET    /api/articles/:id
  Permissions: Based on article permission rules
  Returns: { article: Article }

POST   /api/articles
  Permissions: ADMIN, CLASS_TEACHER (for their class)
  Body: { title, content, classId, articleType, weekNumber, ... }
  Returns: { article: Article }

PATCH  /api/articles/:id
  Permissions: ADMIN, author (CLASS_TEACHER for their class)
  Body: { title?, content?, isPublished?, ... }
  Returns: { article: Article }

DELETE /api/articles/:id
  Permissions: ADMIN, author
  Returns: { success: boolean }
```

## 6. Frontend Integration

### 6.1 TypeScript Types (to add to `/src/types/index.ts`)

```typescript
export enum UserRole {
  ADMIN = 'ADMIN',
  CLASS_TEACHER = 'CLASS_TEACHER',
  PARENT = 'PARENT',
  STUDENT = 'STUDENT'
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatar?: string;
  phoneNumber?: string;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Class {
  id: string;
  name: string;
  grade: number;
  section?: string;
  academicYear: string;
  description?: string;
  teacherId: string;
  teacher?: User; // Populated in API response
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export enum MembershipStatus {
  ACTIVE = 'ACTIVE',
  TRANSFERRED = 'TRANSFERRED',
  WITHDRAWN = 'WITHDRAWN',
  GRADUATED = 'GRADUATED'
}

export interface ClassMembership {
  id: string;
  studentId: string;
  student?: User; // Populated
  classId: string;
  class?: Class; // Populated
  enrollmentDate: string;
  status: MembershipStatus;
  createdAt: string;
  updatedAt: string;
}

export enum RelationType {
  MOTHER = 'MOTHER',
  FATHER = 'FATHER',
  GUARDIAN = 'GUARDIAN',
  STEPMOTHER = 'STEPMOTHER',
  STEPFATHER = 'STEPFATHER',
  GRANDPARENT = 'GRANDPARENT',
  OTHER = 'OTHER'
}

export interface FamilyRelationship {
  id: string;
  parentId: string;
  parent?: User; // Populated
  studentId: string;
  student?: User; // Populated
  relationshipType: RelationType;
  isPrimaryContact: boolean;
  canReceiveUpdates: boolean;
  createdAt: string;
  updatedAt: string;
}

export enum ArticleType {
  ALL_SCHOOL = 'ALL_SCHOOL',
  CLASS_NEWS = 'CLASS_NEWS',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  EVENT = 'EVENT'
}

// Enhanced Article interface
export interface Article {
  id: string;
  title: string;
  content: string;
  author?: string;
  authorId?: string;
  authorUser?: User; // Populated
  summary?: string;
  weekNumber: string;
  classId?: string;
  class?: Class; // Populated
  articleType: ArticleType;
  order: number;
  slug?: string;
  publicUrl: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  isPublished: boolean;
  viewCount?: number;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}
```

### 6.2 Authentication Service

```typescript
// src/services/authService.ts
import { User, AuthResponse } from '../types';

class AuthService {
  private token: string | null = null;
  private user: User | null = null;

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) throw new Error('Login failed');

    const data: AuthResponse = await response.json();
    this.token = data.token;
    this.user = data.user;
    localStorage.setItem('auth_token', data.token);

    return data;
  }

  async logout(): Promise<void> {
    if (this.token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
    }

    this.token = null;
    this.user = null;
    localStorage.removeItem('auth_token');
  }

  async getCurrentUser(): Promise<User | null> {
    const token = this.token || localStorage.getItem('auth_token');
    if (!token) return null;

    const response = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      this.logout();
      return null;
    }

    const { user } = await response.json();
    this.user = user;
    this.token = token;

    return user;
  }

  getToken(): string | null {
    return this.token || localStorage.getItem('auth_token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  hasRole(role: UserRole): boolean {
    return this.user?.role === role;
  }

  isAdmin(): boolean {
    return this.user?.role === UserRole.ADMIN;
  }

  isTeacher(): boolean {
    return this.user?.role === UserRole.CLASS_TEACHER;
  }

  isParent(): boolean {
    return this.user?.role === UserRole.PARENT;
  }

  isStudent(): boolean {
    return this.user?.role === UserRole.STUDENT;
  }
}

export const authService = new AuthService();
```

### 6.3 Permission Helper Utilities

```typescript
// src/utils/permissions.ts
import { User, Article, UserRole, ArticleType } from '../types';

export function canViewArticle(user: User | null, article: Article): boolean {
  // Unauthenticated users can only see all-school articles
  if (!user) {
    return article.articleType === ArticleType.ALL_SCHOOL;
  }

  // Admins can see everything
  if (user.role === UserRole.ADMIN) {
    return true;
  }

  // All-school articles are visible to everyone
  if (article.articleType === ArticleType.ALL_SCHOOL || !article.classId) {
    return true;
  }

  // For class-specific articles, check class access
  // This will need to be validated by the backend
  // Frontend should optimistically show based on user's accessible classes
  return true; // Backend will enforce actual permissions
}

export function canEditArticle(user: User | null, article: Article): boolean {
  if (!user) return false;

  // Admins can edit everything
  if (user.role === UserRole.ADMIN) {
    return true;
  }

  // Teachers can edit their own articles or articles for their class
  if (user.role === UserRole.CLASS_TEACHER) {
    return article.authorId === user.id ||
           (article.classId !== null); // Backend will verify class ownership
  }

  return false;
}

export function canCreateArticle(user: User | null): boolean {
  if (!user) return false;
  return user.role === UserRole.ADMIN || user.role === UserRole.CLASS_TEACHER;
}

export function canManageUsers(user: User | null): boolean {
  if (!user) return false;
  return user.role === UserRole.ADMIN;
}

export function canManageClasses(user: User | null): boolean {
  if (!user) return false;
  return user.role === UserRole.ADMIN;
}

export function canViewClassStudents(user: User | null, classId: string): boolean {
  if (!user) return false;

  if (user.role === UserRole.ADMIN) {
    return true;
  }

  // Teachers can view their own class students
  // Parents can view their children's class students
  // Backend will enforce actual permissions
  return user.role === UserRole.CLASS_TEACHER || user.role === UserRole.PARENT;
}
```

## 7. Implementation Checklist

### Phase 1: Database Setup
- [ ] Set up PostgreSQL database
- [ ] Run schema creation scripts
- [ ] Set up database migrations tool (e.g., Knex, Prisma)
- [ ] Create seed data for testing
- [ ] Set up Row-Level Security policies (if using PostgreSQL RLS)

### Phase 2: Backend API
- [ ] Set up Node.js/Express backend (or your preferred framework)
- [ ] Implement authentication middleware (JWT)
- [ ] Create user management endpoints
- [ ] Create class management endpoints
- [ ] Create family relationship endpoints
- [ ] Enhance article endpoints with permission filtering
- [ ] Add permission checking middleware
- [ ] Write API tests

### Phase 3: Frontend Integration
- [ ] Add TypeScript types for new models
- [ ] Create authentication service
- [ ] Create permission utility functions
- [ ] Add login/logout UI components
- [ ] Add user profile display
- [ ] Implement role-based UI visibility
- [ ] Update article list to show only permitted articles
- [ ] Add article filtering by class (for teachers/parents)

### Phase 4: User Management UI (Admin)
- [ ] User list page
- [ ] User creation form
- [ ] User edit form
- [ ] Class management page
- [ ] Student enrollment management
- [ ] Family relationship management

### Phase 5: Teacher Features
- [ ] Class dashboard for teachers
- [ ] Article creation for class
- [ ] Student list view for their class

### Phase 6: Parent Features
- [ ] Parent dashboard
- [ ] View children's classes
- [ ] View children's class articles
- [ ] Family profile management

### Phase 7: Testing & Security
- [ ] Unit tests for permission logic
- [ ] Integration tests for API endpoints
- [ ] E2E tests for user flows
- [ ] Security audit
- [ ] Performance testing
- [ ] Load testing

## 8. Next Steps

1. **Choose Backend Technology Stack:**
   - Option A: Node.js + Express + PostgreSQL + Prisma
   - Option B: Node.js + NestJS + PostgreSQL + TypeORM
   - Option C: Supabase (Backend-as-a-Service with built-in auth and RLS)

2. **Set Up Development Environment:**
   - Database setup (local PostgreSQL or cloud provider)
   - Backend API server
   - Environment variables configuration

3. **Start with MVP:**
   - User authentication (login/logout)
   - Basic user roles
   - Article filtering for parents (children's classes only)
   - Admin user management

4. **Iterate and Expand:**
   - Add more features progressively
   - Gather user feedback
   - Refine permission rules based on real usage

## 9. Security Considerations

### 9.1 Password Security
- Use bcrypt or argon2 for password hashing
- Minimum password strength requirements
- Password reset functionality with secure tokens
- Rate limiting on login attempts

### 9.2 Authentication Security
- JWT tokens with expiration
- Refresh token rotation
- Secure token storage (httpOnly cookies or secure localStorage)
- CSRF protection

### 9.3 Authorization Security
- Always verify permissions on the backend
- Never trust frontend permission checks
- Use Row-Level Security (RLS) when possible
- Log all permission-sensitive operations

### 9.4 Data Privacy
- Parents can only see their own children's data
- Students can only see their own class data
- Teachers can only see their assigned class data
- Personal information (email, phone) should be protected

### 9.5 Input Validation
- Validate all user inputs on backend
- Sanitize HTML content to prevent XSS
- Use parameterized queries to prevent SQL injection
- Validate file uploads (avatar images)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-16
**Author:** Claude (AI Assistant)
**Status:** Draft - Ready for Review
