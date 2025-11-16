# User System Model Design

## Overview

This document outlines the complete user system model for the Email CMS application, supporting a Waldorf education environment where:
- **Admins** manage the entire system
- **Class Teachers** manage their class content and students
- **Parents** can only view content related to their children's classes
- **Students** can view their own class content

### Key Design Principles

1. **Family-Centric Model**: Families are first-class entities that can include both enrolled students and non-student children
2. **Single Class Membership**: Each student belongs to exactly ONE class at any given time
3. **Persistent Classes**: Classes grow with students year over year (e.g., "甲班" advances from Grade 1 → Grade 2 → Grade 3)
4. **Transfer Tracking**: Student transfers between classes are tracked historically
5. **Permission-Based Access**: Parents can only read 班級大小事 (class news) articles from their children's classes

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

### 1.2 Family Model

```typescript
interface Family {
  id: string;                    // UUID
  familyName?: string;           // Optional family name (e.g., "陳家")
  address?: string;              // Family address
  primaryContactEmail?: string;  // Primary contact email
  primaryContactPhone?: string;  // Primary contact phone
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}

interface FamilyMember {
  id: string;                    // UUID
  familyId: string;              // Foreign key to Family
  userId?: string;               // Foreign key to User (null for non-student children)
  role: FamilyMemberRole;        // Role in family
  firstName: string;             // First name
  lastName: string;              // Last name
  dateOfBirth?: string;          // Date of birth
  isStudent: boolean;            // Is this person a student at school?
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}

enum FamilyMemberRole {
  PARENT = 'PARENT',             // Parent/Guardian with User account
  CHILD = 'CHILD'                // Child (may or may not be a student)
}
```

**Notes:**
- **Family** represents a household that may have multiple parents and children
- **FamilyMember** links individuals to a family
- Children who are **not students** at the school can be tracked (userId = null, isStudent = false)
- Children who **are students** will have a User account (userId set, isStudent = true)
- Parents will have User accounts with role = PARENT
- Supports various family structures

### 1.3 Class Model

```typescript
interface Class {
  id: string;                    // UUID
  name: string;                  // e.g., "甲班" (Class A)
  currentGrade: number;          // Current grade: 1-12 (or K for kindergarten = 0)
  section?: string;              // e.g., "A", "B", "甲", "乙"
  startYear: number;             // Year the class was formed (e.g., 2020)
  description?: string;          // Optional class description
  teacherId: string;             // Foreign key to User (CLASS_TEACHER)
  isActive: boolean;             // Active status
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}
```

**Notes:**
- **Classes are reused** - The same class grows with students year over year
- `currentGrade` is updated annually as students advance (e.g., Grade 1 → Grade 2)
- `startYear` identifies when the class was formed (doesn't change)
- `name` stays consistent (e.g., "甲班" remains "甲班" throughout)
- Each class has ONE primary teacher (teacher may change over years)
- Example: "甲班" formed in 2020, starting at Grade 1
  - 2020-2021: 一年級甲班 (Grade 1A, currentGrade=1)
  - 2021-2022: 二年級甲班 (Grade 2A, currentGrade=2)
  - 2022-2023: 三年級甲班 (Grade 3A, currentGrade=3)
- Same teacher and same classmates progress together

### 1.4 Student-Class Relationship (Class Membership)

```typescript
interface ClassMembership {
  id: string;                    // UUID
  studentId: string;             // Foreign key to User (STUDENT)
  classId: string;               // Foreign key to Class
  joinedDate: string;            // ISO timestamp when student joined this class
  leftDate?: string;             // ISO timestamp when student left (null if still active)
  status: MembershipStatus;      // Current enrollment status
  transferReason?: string;       // Reason for transfer/withdrawal (if applicable)
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
- **A student can only belong to ONE class at a time** (one ACTIVE membership)
- Historical memberships are preserved (not deleted) for tracking transfers
- `joinedDate` tracks when student joined the class
- `leftDate` tracks when student left (null means still active)
- `status = ACTIVE` means student is currently in this class
- When a student transfers to a new class:
  1. Old membership: status → TRANSFERRED, leftDate → transfer date
  2. New membership: created with status = ACTIVE, joinedDate → transfer date
- Database constraint: Only ONE membership with status='ACTIVE' per student

### 1.5 Parent-Child Relationship Type

```typescript
interface ParentChildRelationship {
  id: string;                    // UUID
  parentMemberId: string;        // Foreign key to FamilyMember (PARENT)
  childMemberId: string;         // Foreign key to FamilyMember (CHILD)
  relationshipType: RelationType; // Type of relationship
  isPrimaryGuardian: boolean;    // Is this the child's primary guardian?
  canReceiveUpdates: boolean;    // Can receive school notifications
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
- Links parent and child **within the same family**
- One child can have multiple parents/guardians
- `isPrimaryGuardian` designates main contact for school communications
- `canReceiveUpdates` controls whether this parent receives notifications about this specific child
- Supports various family structures (single parent, guardians, etc.)

### 1.6 Enhanced Article Model

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
┌──────────────────┐
│      Family      │
│  - id (PK)       │
│  - familyName    │
└────────┬─────────┘
         │ 1
         │
         │ N
┌────────▼───────────────┐          ┌────────────────────────┐
│    FamilyMember        │          │  ParentChildRelationship│
│  - id (PK)            │          │  - id (PK)             │
│  - familyId (FK)      │          │  - parentMemberId (FK) │
│  - userId (FK, null)  │◄─────────┤  - childMemberId (FK)  │
│  - role (PARENT/CHILD)│   N:N    │  - relationshipType    │
│  - isStudent          │          │  - isPrimaryGuardian   │
└────────┬───────────────┘          └────────────────────────┘
         │ 0..1
         │ (if isStudent=true)
         │
┌────────▼──────────┐
│       User        │               ┌────────────────────┐
│  - id (PK)        │               │  ClassMembership   │
│  - email (UNIQUE) │               │  - id (PK)         │
│  - role           │◄──────────────┤  - studentId (FK)  │
│  - firstName      │      1:N      │  - classId (FK)    │
│  - lastName       │   (but only   │  - status          │
└────────┬──────────┘    1 ACTIVE)  │  - joinedDate      │
         │                          │  - leftDate        │
         │ N                        └──────┬─────────────┘
         │ (CLASS_TEACHER)                 │ N (but 1 ACTIVE)
         │                                 │
┌────────▼──────────┐                     │ 1
│      Class        │◄────────────────────┘
│  - id (PK)        │
│  - name           │
│  - currentGrade   │
│  - startYear      │
│  - teacherId (FK) │
└────────┬──────────┘
         │ 1
         │
         │ N
┌────────▼──────────┐
│     Article       │
│  - id (PK)        │
│  - classId (FK)   │
│  - authorId (FK)  │
│  - articleType    │
│  - weekNumber     │
└───────────────────┘
```

**Key Relationships:**

1. **Family → FamilyMember (1:N)**
   - One family has multiple members (parents and children)

2. **FamilyMember → ParentChildRelationship (N:N)**
   - Parents and children linked within family
   - Captures relationship type (mother, father, guardian, etc.)

3. **FamilyMember → User (0..1)**
   - If `isStudent=true` and child is enrolled: links to User (STUDENT role)
   - If `role=PARENT`: links to User (PARENT role)
   - If `isStudent=false` (non-enrolled child): userId is null

4. **User (STUDENT) → ClassMembership (1:N)**
   - Student can have multiple memberships over time (historical)
   - **Only ONE membership with status=ACTIVE at any time**

5. **ClassMembership → Class (N:1)**
   - Multiple students belong to one class

6. **User (CLASS_TEACHER) → Class (1:N)**
   - Teacher can teach multiple classes (e.g., when classes advance)

7. **Class → Article (1:N)**
   - Class can have multiple articles (班級大小事)

### 2.2 Database Constraints

**User Table:**
- `email` must be UNIQUE
- `email` must be valid email format
- `role` must be one of UserRole enum
- `passwordHash` must not be null

**Family Table:**
- No special constraints (all fields optional except id)

**FamilyMember Table:**
- `familyId` must reference valid Family
- `userId` can be null (for non-student children)
- If `userId` is not null, must reference valid User
- If `role = PARENT`, then `userId` must reference User with role = PARENT
- If `role = CHILD` and `isStudent = true`, then `userId` must reference User with role = STUDENT
- Unique constraint on `userId` (if not null) - one User can only be in one family

**ParentChildRelationship Table:**
- `parentMemberId` must reference FamilyMember with role = PARENT
- `childMemberId` must reference FamilyMember with role = CHILD
- Both members must belong to the same `familyId`
- Unique constraint on (parentMemberId, childMemberId) - prevents duplicate relationships
- `relationshipType` must be one of RelationType enum

**Class Table:**
- `teacherId` must reference valid User with role = CLASS_TEACHER
- `name` + `startYear` should be unique (composite constraint)
- `currentGrade` must be 0-12
- `startYear` must be a valid year

**ClassMembership Table:**
- `studentId` must reference valid User with role = STUDENT
- `classId` must reference valid Class
- **Critical constraint:** Only ONE membership with `status = 'ACTIVE'` per student
  - Use unique partial index: `CREATE UNIQUE INDEX idx_one_active_membership ON class_memberships(student_id) WHERE status = 'ACTIVE';`
- `status` must be one of MembershipStatus enum
- If `status != 'ACTIVE'`, then `leftDate` must not be null
- `joinedDate` must not be null

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
      // Get parent's FamilyMember record
      const parentMember = await getFamilyMemberByUserId(user.id);
      // Get all children of this parent
      const childMembers = await getChildrenByParentMember(parentMember.id);
      // Get User IDs of children who are students
      const studentUserIds = childMembers.filter(c => c.isStudent && c.userId).map(c => c.userId);
      // Get class IDs for these students
      const childrenClassIds = await getActiveClassIdsByStudentIds(studentUserIds);
      return childrenClassIds.includes(article.classId);

    case UserRole.STUDENT:
      // Students can view articles from their own class (only one ACTIVE class)
      const activeClassId = await getActiveClassIdByStudent(user.id);
      return activeClassId === article.classId;

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
        WHERE cm.student_id IN (
          -- Get student User IDs for parent's children
          SELECT child_fm.user_id
          FROM family_members parent_fm
          JOIN parent_child_relationships pcr ON parent_fm.id = pcr.parent_member_id
          JOIN family_members child_fm ON pcr.child_member_id = child_fm.id
          WHERE parent_fm.user_id = auth.uid()
            AND child_fm.is_student = true
            AND child_fm.user_id IS NOT NULL
        )
        AND cm.status = 'ACTIVE'
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
      // Get parent's family member record
      const parentMember = await db.familyMembers
        .where('user_id', user.id)
        .where('role', 'PARENT')
        .first();

      if (!parentMember) return [];

      // Get children who are students
      const childStudentIds = await db.familyMembers
        .join('parent_child_relationships', 'family_members.id', 'parent_child_relationships.child_member_id')
        .where('parent_child_relationships.parent_member_id', parentMember.id)
        .where('family_members.is_student', true)
        .whereNotNull('family_members.user_id')
        .pluck('family_members.user_id');

      if (childStudentIds.length === 0) return [];

      // Get active classes for these students
      return await db.classMemberships
        .whereIn('student_id', childStudentIds)
        .where('status', 'ACTIVE')
        .pluck('class_id');

    case UserRole.STUDENT:
      // Student only has ONE active class
      const activeClass = await db.classMemberships
        .where('student_id', user.id)
        .where('status', 'ACTIVE')
        .first();

      return activeClass ? [activeClass.class_id] : [];

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

-- Family table
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_name VARCHAR(100),
  address TEXT,
  primary_contact_email VARCHAR(255),
  primary_contact_phone VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Family member table
CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('PARENT', 'CHILD')),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  is_student BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_per_family UNIQUE (user_id)
);

-- Create indexes
CREATE INDEX idx_family_members_family_id ON family_members(family_id);
CREATE INDEX idx_family_members_user_id ON family_members(user_id);
CREATE INDEX idx_family_members_role ON family_members(role);
CREATE INDEX idx_family_members_is_student ON family_members(is_student);

-- Parent-child relationship table
CREATE TABLE parent_child_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  child_member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL CHECK (
    relationship_type IN ('MOTHER', 'FATHER', 'GUARDIAN', 'STEPMOTHER', 'STEPFATHER', 'GRANDPARENT', 'OTHER')
  ),
  is_primary_guardian BOOLEAN DEFAULT false,
  can_receive_updates BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_parent_child UNIQUE (parent_member_id, child_member_id),
  -- Ensure parent and child are different people
  CONSTRAINT different_parent_child CHECK (parent_member_id != child_member_id)
);

-- Create indexes
CREATE INDEX idx_pcr_parent_member_id ON parent_child_relationships(parent_member_id);
CREATE INDEX idx_pcr_child_member_id ON parent_child_relationships(child_member_id);
CREATE INDEX idx_pcr_is_primary ON parent_child_relationships(is_primary_guardian);

-- Class table
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  current_grade INTEGER NOT NULL CHECK (current_grade >= 0 AND current_grade <= 12),
  section VARCHAR(10),
  start_year INTEGER NOT NULL,
  description TEXT,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_class_per_start_year UNIQUE (name, start_year)
);

-- Create indexes
CREATE INDEX idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX idx_classes_start_year ON classes(start_year);
CREATE INDEX idx_classes_current_grade ON classes(current_grade);
CREATE INDEX idx_classes_is_active ON classes(is_active);

-- Class membership table
CREATE TABLE class_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  joined_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  left_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) NOT NULL CHECK (status IN ('ACTIVE', 'TRANSFERRED', 'WITHDRAWN', 'GRADUATED')),
  transfer_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure if not active, must have left_date
  CONSTRAINT left_date_required CHECK (
    (status = 'ACTIVE' AND left_date IS NULL) OR
    (status != 'ACTIVE' AND left_date IS NOT NULL)
  )
);

-- Create indexes
CREATE INDEX idx_class_memberships_student_id ON class_memberships(student_id);
CREATE INDEX idx_class_memberships_class_id ON class_memberships(class_id);
CREATE INDEX idx_class_memberships_status ON class_memberships(status);

-- CRITICAL: Ensure only ONE active membership per student
CREATE UNIQUE INDEX idx_one_active_membership_per_student
  ON class_memberships(student_id)
  WHERE status = 'ACTIVE';

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

CREATE TRIGGER update_families_updated_at BEFORE UPDATE ON families
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_family_members_updated_at BEFORE UPDATE ON family_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pcr_updated_at BEFORE UPDATE ON parent_child_relationships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_class_memberships_updated_at BEFORE UPDATE ON class_memberships
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

-- Insert sample class (starts in 2020, now in Grade 5 in 2024-2025)
INSERT INTO classes (name, current_grade, section, start_year, teacher_id, is_active)
VALUES
  ('甲班', 5, '甲', 2020, (SELECT id FROM users WHERE email = 'teacher1@school.com'), true);

-- Insert sample student users
INSERT INTO users (email, password_hash, role, first_name, last_name, is_active, email_verified)
VALUES
  ('student1@school.com', '$2b$10$...', 'STUDENT', '小明', '陳', true, true),
  ('student2@school.com', '$2b$10$...', 'STUDENT', '小華', '林', true, true);

-- Insert sample parent users
INSERT INTO users (email, password_hash, role, first_name, last_name, is_active, email_verified)
VALUES
  ('parent1@example.com', '$2b$10$...', 'PARENT', '大明', '陳', true, true),
  ('parent2@example.com', '$2b$10$...', 'PARENT', '美玲', '陳', true, true);

-- Create a family
INSERT INTO families (family_name, address, primary_contact_email, primary_contact_phone)
VALUES
  ('陳家', '台北市信義區xx路xx號', 'parent1@example.com', '0912-345-678');

-- Add parents to family
INSERT INTO family_members (family_id, user_id, role, first_name, last_name, is_student)
VALUES
  ((SELECT id FROM families WHERE family_name = '陳家'),
   (SELECT id FROM users WHERE email = 'parent1@example.com'),
   'PARENT', '大明', '陳', false),
  ((SELECT id FROM families WHERE family_name = '陳家'),
   (SELECT id FROM users WHERE email = 'parent2@example.com'),
   'PARENT', '美玲', '陳', false);

-- Add children to family (one student, one non-student sibling)
INSERT INTO family_members (family_id, user_id, role, first_name, last_name, date_of_birth, is_student)
VALUES
  -- Student child
  ((SELECT id FROM families WHERE family_name = '陳家'),
   (SELECT id FROM users WHERE email = 'student1@school.com'),
   'CHILD', '小明', '陳', '2015-03-15', true),
  -- Non-student sibling (younger child not yet enrolled)
  ((SELECT id FROM families WHERE family_name = '陳家'),
   NULL,  -- No User account
   'CHILD', '小美', '陳', '2020-08-20', false);

-- Create parent-child relationships
INSERT INTO parent_child_relationships (parent_member_id, child_member_id, relationship_type, is_primary_guardian)
VALUES
  -- Father to student child
  ((SELECT id FROM family_members WHERE user_id = (SELECT id FROM users WHERE email = 'parent1@example.com')),
   (SELECT id FROM family_members WHERE user_id = (SELECT id FROM users WHERE email = 'student1@school.com')),
   'FATHER', true),
  -- Mother to student child
  ((SELECT id FROM family_members WHERE user_id = (SELECT id FROM users WHERE email = 'parent2@example.com')),
   (SELECT id FROM family_members WHERE user_id = (SELECT id FROM users WHERE email = 'student1@school.com')),
   'MOTHER', false),
  -- Father to non-student sibling
  ((SELECT id FROM family_members WHERE user_id = (SELECT id FROM users WHERE email = 'parent1@example.com')),
   (SELECT id FROM family_members WHERE user_id IS NULL AND first_name = '小美'),
   'FATHER', true),
  -- Mother to non-student sibling
  ((SELECT id FROM family_members WHERE user_id = (SELECT id FROM users WHERE email = 'parent2@example.com')),
   (SELECT id FROM family_members WHERE user_id IS NULL AND first_name = '小美'),
   'MOTHER', false);

-- Link students to class (ACTIVE membership)
INSERT INTO class_memberships (student_id, class_id, joined_date, status)
VALUES
  ((SELECT id FROM users WHERE email = 'student1@school.com'),
   (SELECT id FROM classes WHERE name = '甲班' AND start_year = 2020),
   '2020-09-01', 'ACTIVE'),
  ((SELECT id FROM users WHERE email = 'student2@school.com'),
   (SELECT id FROM classes WHERE name = '甲班' AND start_year = 2020),
   '2020-09-01', 'ACTIVE');

-- Insert sample class article (班級大小事)
INSERT INTO articles (
  title, content, author, author_id, week_number,
  class_id, article_type, "order", public_url, is_published
)
VALUES
  ('本週班級活動', '本週我們進行了戶外教學...', '王老師',
   (SELECT id FROM users WHERE email = 'teacher1@school.com'),
   '2025-W43',
   (SELECT id FROM classes WHERE name = '甲班' AND start_year = 2020),
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

-- Example: Student transfer scenario
-- If student1 transfers to another class, update the old membership and create a new one:
-- UPDATE class_memberships
-- SET status = 'TRANSFERRED', left_date = '2025-01-15', transfer_reason = 'Transferred to Class B'
-- WHERE student_id = (SELECT id FROM users WHERE email = 'student1@school.com')
--   AND status = 'ACTIVE';
--
-- INSERT INTO class_memberships (student_id, class_id, joined_date, status)
-- VALUES ((SELECT id FROM users WHERE email = 'student1@school.com'),
--         <new_class_id>, '2025-01-15', 'ACTIVE');
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

### 5.4 Family Management Endpoints

```typescript
GET    /api/families
  Query: ?limit=20&offset=0
  Permissions: ADMIN only
  Returns: { families: Family[], total: number }

GET    /api/families/:id
  Permissions: ADMIN or member of family
  Returns: { family: Family, members: FamilyMember[], relationships: ParentChildRelationship[] }

POST   /api/families
  Permissions: ADMIN only
  Body: { familyName, address, primaryContactEmail, primaryContactPhone }
  Returns: { family: Family }

PATCH  /api/families/:id
  Permissions: ADMIN only
  Body: { familyName?, address?, ... }
  Returns: { family: Family }

DELETE /api/families/:id
  Permissions: ADMIN only
  Returns: { success: boolean }

GET    /api/families/:familyId/members
  Permissions: ADMIN or member of family
  Returns: { members: FamilyMember[] }

POST   /api/families/:familyId/members
  Permissions: ADMIN only
  Body: { userId?, role, firstName, lastName, dateOfBirth?, isStudent }
  Returns: { member: FamilyMember }

PATCH  /api/families/:familyId/members/:memberId
  Permissions: ADMIN only
  Body: { firstName?, lastName?, isStudent?, ... }
  Returns: { member: FamilyMember }

DELETE /api/families/:familyId/members/:memberId
  Permissions: ADMIN only
  Returns: { success: boolean }

POST   /api/families/:familyId/relationships
  Permissions: ADMIN only
  Body: { parentMemberId, childMemberId, relationshipType, isPrimaryGuardian }
  Returns: { relationship: ParentChildRelationship }

DELETE /api/families/:familyId/relationships/:relationshipId
  Permissions: ADMIN only
  Returns: { success: boolean }

GET    /api/families/my-family
  Permissions: PARENT only
  Returns: { family: Family, members: FamilyMember[], myChildren: FamilyMember[] }

GET    /api/families/my-children
  Permissions: PARENT only
  Returns: { children: FamilyMember[] }
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

export interface Family {
  id: string;
  familyName?: string;
  address?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  createdAt: string;
  updatedAt: string;
}

export enum FamilyMemberRole {
  PARENT = 'PARENT',
  CHILD = 'CHILD'
}

export interface FamilyMember {
  id: string;
  familyId: string;
  family?: Family; // Populated
  userId?: string;
  user?: User; // Populated if userId is set
  role: FamilyMemberRole;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  isStudent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ParentChildRelationship {
  id: string;
  parentMemberId: string;
  parentMember?: FamilyMember; // Populated
  childMemberId: string;
  childMember?: FamilyMember; // Populated
  relationshipType: RelationType;
  isPrimaryGuardian: boolean;
  canReceiveUpdates: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Class {
  id: string;
  name: string;
  currentGrade: number;
  section?: string;
  startYear: number;
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
  joinedDate: string;
  leftDate?: string;
  status: MembershipStatus;
  transferReason?: string;
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

## Document Change Log

### Version 2.0 (2025-11-16)
**Major Revision** - Updated based on clarified requirements:
- **Added Family Model**: Introduced `Family`, `FamilyMember`, and `ParentChildRelationship` tables to support families with non-student children
- **Single Class Membership**: Changed to enforce ONE active class per student (partial unique index)
- **Persistent Classes**: Modified Class model to use `currentGrade` and `startYear` instead of `academicYear` - classes advance with students
- **Transfer Tracking**: Added `joinedDate`, `leftDate`, and `transferReason` to ClassMembership
- **Updated Permissions**: Revised parent permission logic to work through Family → FamilyMember → ParentChildRelationship
- **Enhanced Sample Data**: Added example showing family with both student and non-student children

### Version 1.0 (2025-11-16)
Initial design with basic user roles and direct parent-student relationships.

---

**Document Version:** 2.0
**Last Updated:** 2025-11-16
**Author:** Claude (AI Assistant)
**Status:** Revised - Ready for Implementation
