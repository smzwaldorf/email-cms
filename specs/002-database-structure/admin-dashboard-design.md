# Admin Dashboard Design

**Feature**: Admin Dashboard for Email CMS
**Status**: Design Phase
**Date**: 2025-11-20

## Table of Contents
1. [Overview](#overview)
2. [Data Structure](#data-structure)
3. [Wireframes](#wireframes)
4. [Component Architecture](#component-architecture)
5. [API Design](#api-design)
6. [Security & Permissions](#security--permissions)

---

## Overview

### Purpose
A centralized admin dashboard to manage all aspects of the Email CMS system:
- User management (create, edit, delete users and assign roles)
- Week & article management (CRUD operations)
- Class management (create/edit classes, view enrollments)
- Family management (create families, manage enrollments)
- System analytics and audit logs

### User Roles
The dashboard is accessible only to users with `role = 'admin'` in the `user_roles` table.

---

## Data Structure

### Existing Database Schema (No Changes Required)

The current schema already supports all admin dashboard functionality:

#### 1. User Management
**Table**: `user_roles`
```sql
- id (UUID, references auth.users)
- email (VARCHAR)
- role (admin | teacher | parent | student)
- created_at, updated_at
```

**Operations**:
- List all users with filtering by role
- Create new user (requires Supabase Auth API + user_roles insert)
- Update user role
- Delete user (cascade deletes enrollments)

#### 2. Week Management
**Table**: `newsletter_weeks`
```sql
- week_number (VARCHAR, PK, format: "YYYY-Www")
- release_date (DATE)
- is_published (BOOLEAN)
- created_at, updated_at
```

**Operations**:
- List all weeks (published and unpublished)
- Create new week
- Update week metadata (release_date, is_published)
- Delete week (cascades to articles)

#### 3. Article Management
**Table**: `articles`
```sql
- id (UUID)
- week_number (FK to newsletter_weeks)
- title, content, author
- article_order (INT)
- is_published (BOOLEAN)
- visibility_type (public | class_restricted)
- restricted_to_classes (JSONB array of class IDs)
- created_by (UUID)
- created_at, updated_at, deleted_at
- short_id (VARCHAR)
```

**Operations**:
- List all articles (with week, author, visibility info)
- Create new article
- Update article (content, visibility, order)
- Soft-delete article (set deleted_at)
- Reorder articles within a week

#### 4. Class Management
**Table**: `classes`
```sql
- id (VARCHAR, PK, e.g., "A1")
- class_name (TEXT, e.g., "Grade 1A")
- class_grade_year (INT, 1-12)
- created_at
```

**Operations**:
- List all classes
- Create new class
- Update class name/grade
- View enrolled students (join child_class_enrollment)
- View assigned teachers (join teacher_class_assignment)

#### 5. Family Management
**Tables**:
- `families` (id, family_code, created_at)
- `family_enrollment` (family_id, parent_id, relationship)
- `child_class_enrollment` (child_id, family_id, class_id, enrolled_at, graduated_at)

**Operations**:
- List all families with parent/child counts
- Create new family (auto-generate family_code)
- Add parent to family
- Enroll child in class
- Graduate child from class (set graduated_at)

#### 6. Audit & Analytics
**Table**: `article_audit_log`
```sql
- id (UUID)
- article_id (FK)
- action (create | update | publish | unpublish | delete)
- changed_by (UUID)
- old_values, new_values (JSONB)
- changed_at
```

**Operations**:
- View audit trail for specific article
- View recent system-wide changes
- Filter by action type or user

### Additional Views (PostgreSQL Materialized Views - Optional)

For performance optimization, we can add materialized views:

```sql
-- Dashboard statistics view
CREATE MATERIALIZED VIEW admin_dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM user_roles) AS total_users,
  (SELECT COUNT(*) FROM user_roles WHERE role = 'admin') AS admin_count,
  (SELECT COUNT(*) FROM user_roles WHERE role = 'teacher') AS teacher_count,
  (SELECT COUNT(*) FROM user_roles WHERE role = 'parent') AS parent_count,
  (SELECT COUNT(*) FROM user_roles WHERE role = 'student') AS student_count,
  (SELECT COUNT(*) FROM newsletter_weeks) AS total_weeks,
  (SELECT COUNT(*) FROM newsletter_weeks WHERE is_published = true) AS published_weeks,
  (SELECT COUNT(*) FROM articles WHERE deleted_at IS NULL) AS total_articles,
  (SELECT COUNT(*) FROM articles WHERE is_published = true AND deleted_at IS NULL) AS published_articles,
  (SELECT COUNT(*) FROM classes) AS total_classes,
  (SELECT COUNT(*) FROM families) AS total_families;

-- Refresh on dashboard load
REFRESH MATERIALIZED VIEW admin_dashboard_stats;
```

---

## Wireframes

### 1. Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo] Email CMS Admin Dashboard           [User] [Logout]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │ Users   │  │ Weeks   │  │Articles │  │ Classes │          │
│  │  156    │  │   24    │  │  312    │  │   12    │          │
│  │ 👥      │  │ 📅      │  │ 📄      │  │ 🏫      │          │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘          │
│                                                                 │
│  Recent Activity                          Quick Actions        │
│  ┌──────────────────────────────────┐    ┌──────────────────┐ │
│  │ • Admin edited "Week 48 Article" │    │ + Create User    │ │
│  │   2 minutes ago                  │    │ + Create Week    │ │
│  │ • Teacher added "New Article"    │    │ + Create Article │ │
│  │   15 minutes ago                 │    │ + Create Class   │ │
│  │ • Parent joined Family FAMILY003 │    └──────────────────┘ │
│  │   1 hour ago                     │                         │
│  └──────────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

### 2. User Management Page

```
┌─────────────────────────────────────────────────────────────────┐
│  Users Management                           [+ Create User]     │
├─────────────────────────────────────────────────────────────────┤
│  Filters: [All Roles ▼] [Search by email...]                   │
├──────┬─────────────────────────┬───────────┬────────────────────┤
│ Role │ Email                   │ Created   │ Actions            │
├──────┼─────────────────────────┼───────────┼────────────────────┤
│ 👤Admin│ admin@example.com      │ 2025-11-01│ [Edit] [Delete]   │
│ 👨‍🏫Teacher│ teacher1@example.com│ 2025-11-05│ [Edit] [Delete]   │
│ 👨‍👩‍👧Parent│ parent1@example.com │ 2025-11-10│ [Edit] [Delete]   │
│ 👶Student│ student1@example.com│ 2025-11-12│ [Edit] [Delete]   │
└──────┴─────────────────────────┴───────────┴────────────────────┘
```

### 3. User Edit Modal

```
┌──────────────────────────────────┐
│  Edit User                    [X]│
├──────────────────────────────────┤
│  Email:                          │
│  [parent1@example.com         ]  │
│                                  │
│  Role:                           │
│  [Parent            ▼]           │
│                                  │
│  Family:                         │
│  [FAMILY001         ▼]           │
│  (Only for parent/student)       │
│                                  │
│  Classes (for students):         │
│  [☑ A1 - Grade 1A]              │
│  [☐ A2 - Grade 1B]              │
│  [☑ B1 - Grade 2A]              │
│                                  │
│     [Cancel]  [Save Changes]     │
└──────────────────────────────────┘
```

### 4. Week Management Page

```
┌─────────────────────────────────────────────────────────────────┐
│  Newsletter Weeks                           [+ Create Week]     │
├─────────────────────────────────────────────────────────────────┤
│  Filters: [All ▼] [2025 ▼]                                     │
├────────────┬─────────────┬──────────┬──────────┬───────────────┤
│ Week       │ Release     │ Articles │ Status   │ Actions       │
├────────────┼─────────────┼──────────┼──────────┼───────────────┤
│ 2025-W49   │ 2025-12-02  │ 5        │ 🟢 Published│[Edit][View]│
│ 2025-W48   │ 2025-11-25  │ 8        │ 🟢 Published│[Edit][View]│
│ 2025-W47   │ 2025-11-18  │ 6        │ ⚪ Draft  │[Edit][View]│
└────────────┴─────────────┴──────────┴──────────┴───────────────┘
```

### 5. Article Management Page

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Articles                                       [+ Create Article]      │
├─────────────────────────────────────────────────────────────────────────┤
│  Filters: [All Weeks ▼] [All Visibility ▼] [Search title...]           │
├──────────────────────┬──────┬────────┬──────────────┬───────────────────┤
│ Title                │ Week │ Order  │ Visibility   │ Actions           │
├──────────────────────┼──────┼────────┼──────────────┼───────────────────┤
│ "校園新聞快報"         │ W49  │ 1      │ 🌍 Public    │[Edit][Delete][↑↓]│
│ "家長須知 - A班"      │ W49  │ 2      │ 🔒 A1, B1    │[Edit][Delete][↑↓]│
│ "數學課程更新"        │ W48  │ 1      │ 🌍 Public    │[Edit][Delete][↑↓]│
└──────────────────────┴──────┴────────┴──────────────┴───────────────────┘
```

### 6. Class Management Page

```
┌─────────────────────────────────────────────────────────────────┐
│  Classes                                    [+ Create Class]    │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────────┬─────────────────┬──────────────────┐   │
│  │ Grade 1            │ Grade 2         │ Grade 3          │   │
│  ├────────────────────┼─────────────────┼──────────────────┤   │
│  │ A1 - Grade 1A      │ B1 - Grade 2A   │ C1 - Grade 3A    │   │
│  │ 👶 24 students     │ 👶 22 students  │ 👶 26 students   │   │
│  │ 👨‍🏫 Ms. Wang       │ 👨‍🏫 Mr. Chen    │ 👨‍🏫 Ms. Liu      │   │
│  │ [View] [Edit]      │ [View] [Edit]   │ [View] [Edit]    │   │
│  │                    │                 │                  │   │
│  │ A2 - Grade 1B      │ B2 - Grade 2B   │ C2 - Grade 3B    │   │
│  │ 👶 21 students     │ 👶 23 students  │ 👶 25 students   │   │
│  │ 👨‍🏫 Mr. Lee        │ 👨‍🏫 Ms. Yang    │ 👨‍🏫 Mr. Zhou     │   │
│  │ [View] [Edit]      │ [View] [Edit]   │ [View] [Edit]    │   │
│  └────────────────────┴─────────────────┴──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 7. Family Management Page

```
┌─────────────────────────────────────────────────────────────────┐
│  Families                                   [+ Create Family]   │
├─────────────────────────────────────────────────────────────────┤
│  [Search family code or parent email...]                        │
├──────────────┬──────────────────┬──────────┬────────────────────┤
│ Family Code  │ Parents          │ Children │ Actions            │
├──────────────┼──────────────────┼──────────┼────────────────────┤
│ FAMILY001    │ 2 (Mother, Father│ 2        │ [View] [Edit]     │
│              │ parent1@...)     │ (A1, B1) │                    │
├──────────────┼──────────────────┼──────────┼────────────────────┤
│ FAMILY002    │ 1 (Mother        │ 1        │ [View] [Edit]     │
│              │ parent2@...)     │ (A2)     │                    │
└──────────────┴──────────────────┴──────────┴────────────────────┘
```

### 8. Audit Log Page

```
┌─────────────────────────────────────────────────────────────────┐
│  Audit Log                                                      │
├─────────────────────────────────────────────────────────────────┤
│  Filters: [All Actions ▼] [All Users ▼] [Last 7 days ▼]       │
├──────────┬─────────────────┬────────────┬──────────────────────┤
│ Timestamp│ User            │ Action     │ Details              │
├──────────┼─────────────────┼────────────┼──────────────────────┤
│ 14:32    │ admin@example   │ UPDATE     │ Article "校園新聞"   │
│          │                 │            │ [View Changes]       │
├──────────┼─────────────────┼────────────┼──────────────────────┤
│ 13:15    │ teacher1@ex...  │ CREATE     │ New article for W49  │
│          │                 │            │ [View Details]       │
├──────────┼─────────────────┼────────────┼──────────────────────┤
│ 11:05    │ admin@example   │ PUBLISH    │ Week 2025-W48        │
│          │                 │            │ [View Changes]       │
└──────────┴─────────────────┴────────────┴──────────────────────┘
```

---

## Component Architecture

### Page Components (src/pages/admin/)

```
AdminDashboard/
├── AdminDashboardPage.tsx        # Main dashboard (stats & recent activity)
├── UserManagementPage.tsx        # User CRUD
├── WeekManagementPage.tsx        # Week CRUD
├── ArticleManagementPage.tsx     # Article CRUD with reordering
├── ClassManagementPage.tsx       # Class CRUD
├── FamilyManagementPage.tsx      # Family CRUD
└── AuditLogPage.tsx              # Audit trail viewer
```

### Shared Components (src/components/admin/)

```
admin/
├── AdminLayout.tsx               # Wrapper with sidebar navigation
├── StatsCard.tsx                 # Reusable stat card (users count, etc.)
├── DataTable.tsx                 # Generic table with sorting/filtering
├── UserEditModal.tsx             # User create/edit modal
├── WeekEditModal.tsx             # Week create/edit modal
├── ArticleEditModal.tsx          # Article create/edit modal
├── ClassEditModal.tsx            # Class create/edit modal
├── FamilyEditModal.tsx           # Family create/edit modal
├── AuditLogViewer.tsx            # Audit log detail viewer
└── ConfirmDialog.tsx             # Confirmation dialog for destructive actions
```

### Routing (src/App.tsx additions)

```typescript
// Admin routes (protected by AdminRoute wrapper)
<Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
  <Route index element={<AdminDashboardPage />} />
  <Route path="users" element={<UserManagementPage />} />
  <Route path="weeks" element={<WeekManagementPage />} />
  <Route path="articles" element={<ArticleManagementPage />} />
  <Route path="classes" element={<ClassManagementPage />} />
  <Route path="families" element={<FamilyManagementPage />} />
  <Route path="audit" element={<AuditLogPage />} />
</Route>
```

### Services (src/services/admin/)

```
admin/
├── adminUserService.ts           # User CRUD operations
├── adminWeekService.ts           # Week CRUD operations
├── adminArticleService.ts        # Article CRUD operations
├── adminClassService.ts          # Class CRUD operations
├── adminFamilyService.ts         # Family CRUD operations
├── adminAuditService.ts          # Audit log queries
└── adminStatsService.ts          # Dashboard statistics
```

---

## API Design

### User Management APIs

```typescript
// GET /admin/users
interface ListUsersRequest {
  role?: 'admin' | 'teacher' | 'parent' | 'student';
  search?: string;
  limit?: number;
  offset?: number;
}

interface ListUsersResponse {
  users: UserRoleRow[];
  total: number;
}

// POST /admin/users
interface CreateUserRequest {
  email: string;
  password: string;
  role: 'admin' | 'teacher' | 'parent' | 'student';
  familyId?: string; // Required for parent/student
  classIds?: string[]; // Required for student
}

// PATCH /admin/users/:userId
interface UpdateUserRequest {
  email?: string;
  role?: 'admin' | 'teacher' | 'parent' | 'student';
}

// DELETE /admin/users/:userId
// Returns 204 No Content on success
```

### Week Management APIs

```typescript
// GET /admin/weeks
interface ListWeeksResponse {
  weeks: NewsletterWeekRow[];
  total: number;
}

// POST /admin/weeks
interface CreateWeekRequest {
  weekNumber: string; // "YYYY-Www"
  releaseDate: string; // ISO date
  isPublished: boolean;
}

// PATCH /admin/weeks/:weekNumber
interface UpdateWeekRequest {
  releaseDate?: string;
  isPublished?: boolean;
}

// DELETE /admin/weeks/:weekNumber
// Cascades to articles
```

### Article Management APIs

```typescript
// GET /admin/articles
interface ListArticlesRequest {
  weekNumber?: string;
  visibilityType?: 'public' | 'class_restricted';
  search?: string;
  limit?: number;
  offset?: number;
}

interface ListArticlesResponse {
  articles: ArticleRow[];
  total: number;
}

// POST /admin/articles
interface CreateArticleRequest {
  weekNumber: string;
  title: string;
  content: string;
  author?: string;
  articleOrder: number;
  isPublished: boolean;
  visibilityType: 'public' | 'class_restricted';
  restrictedToClasses?: string[];
}

// PATCH /admin/articles/:articleId
interface UpdateArticleRequest {
  title?: string;
  content?: string;
  author?: string;
  articleOrder?: number;
  isPublished?: boolean;
  visibilityType?: 'public' | 'class_restricted';
  restrictedToClasses?: string[];
}

// POST /admin/articles/reorder
interface ReorderArticlesRequest {
  weekNumber: string;
  articleOrders: Array<{ articleId: string; newOrder: number }>;
}

// DELETE /admin/articles/:articleId (soft delete)
// Sets deleted_at timestamp
```

### Class Management APIs

```typescript
// GET /admin/classes
interface ListClassesResponse {
  classes: Array<ClassRow & {
    studentCount: number;
    teacherCount: number;
  }>;
}

// POST /admin/classes
interface CreateClassRequest {
  id: string; // "A1"
  className: string; // "Grade 1A"
  classGradeYear: number; // 1-12
}

// PATCH /admin/classes/:classId
interface UpdateClassRequest {
  className?: string;
  classGradeYear?: number;
}

// GET /admin/classes/:classId/students
interface ClassStudentsResponse {
  students: Array<UserRoleRow & {
    familyId: string;
    enrolledAt: string;
    graduatedAt?: string;
  }>;
}

// GET /admin/classes/:classId/teachers
interface ClassTeachersResponse {
  teachers: Array<UserRoleRow & {
    assignedAt: string;
  }>;
}
```

### Family Management APIs

```typescript
// GET /admin/families
interface ListFamiliesResponse {
  families: Array<FamilyRow & {
    parentCount: number;
    childCount: number;
    parents: UserRoleRow[];
  }>;
}

// POST /admin/families
interface CreateFamilyRequest {
  familyCode?: string; // Auto-generated if not provided
}

// POST /admin/families/:familyId/parents
interface AddParentRequest {
  parentId: string;
  relationship: 'father' | 'mother' | 'guardian';
}

// POST /admin/families/:familyId/children
interface EnrollChildRequest {
  childId: string;
  classId: string;
}

// PATCH /admin/families/:familyId/children/:enrollmentId/graduate
// Sets graduated_at to current timestamp
```

### Audit Log APIs

```typescript
// GET /admin/audit
interface ListAuditLogsRequest {
  articleId?: string;
  action?: 'create' | 'update' | 'publish' | 'unpublish' | 'delete';
  changedBy?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

interface ListAuditLogsResponse {
  logs: Array<ArticleAuditLogRow & {
    changedByUser?: UserRoleRow;
    article?: ArticleRow;
  }>;
  total: number;
}
```

### Dashboard Statistics API

```typescript
// GET /admin/stats
interface DashboardStatsResponse {
  totalUsers: number;
  adminCount: number;
  teacherCount: number;
  parentCount: number;
  studentCount: number;
  totalWeeks: number;
  publishedWeeks: number;
  totalArticles: number;
  publishedArticles: number;
  totalClasses: number;
  totalFamilies: number;
  recentActivity: Array<{
    timestamp: string;
    userId: string;
    userEmail: string;
    action: string;
    description: string;
  }>;
}
```

---

## Security & Permissions

### Authentication & Authorization

1. **Admin-Only Access**: All admin routes require `role = 'admin'`
2. **Protected Route Wrapper**:
   ```typescript
   // src/components/admin/AdminRoute.tsx
   function AdminRoute({ children }) {
     const { user, role } = useAuth();

     if (!user) {
       return <Navigate to="/login" />;
     }

     if (role !== 'admin') {
       return <Navigate to="/unauthorized" />;
     }

     return children;
   }
   ```

3. **Row-Level Security (RLS) Policies**:
   ```sql
   -- Allow admins to read all data
   CREATE POLICY admin_read_all
     ON public.user_roles FOR SELECT
     USING (
       auth.uid() IN (
         SELECT id FROM public.user_roles WHERE role = 'admin'
       )
     );

   -- Allow admins to update/delete
   CREATE POLICY admin_write_all
     ON public.user_roles FOR ALL
     USING (
       auth.uid() IN (
         SELECT id FROM public.user_roles WHERE role = 'admin'
       )
     );
   ```

4. **Audit Trail**: All CUD operations automatically logged via database triggers

### Input Validation

- Email format validation (regex)
- Week number format validation ("YYYY-Www")
- Class ID format validation (alphanumeric, max 10 chars)
- Family code uniqueness check
- Article order uniqueness per week

### CSRF Protection

- Use Supabase session tokens for all API requests
- No cookie-based authentication

### Rate Limiting

- Implement rate limiting on admin endpoints (e.g., 100 requests/minute)
- Use Supabase Edge Functions with Deno rate limiter

---

## Implementation Priority

### Phase 1: Core Admin Pages
1. AdminLayout with navigation
2. AdminDashboardPage (stats + recent activity)
3. UserManagementPage (list, create, edit, delete)

### Phase 2: Content Management
4. WeekManagementPage
5. ArticleManagementPage (with reordering)

### Phase 3: Organizational Management
6. ClassManagementPage
7. FamilyManagementPage

### Phase 4: Auditing & Analytics
8. AuditLogPage
9. Advanced analytics dashboard

---

## Technology Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS with Waldorf color palette
- **State Management**: React Context API + SWR for data fetching
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod validation
- **Tables**: TanStack Table (React Table v8)
- **Backend**: Supabase (PostgreSQL + Auth + RLS)

---

## Next Steps

1. Create wireframe mockups (Figma or similar)
2. Implement AdminLayout component
3. Build data table component with sorting/filtering
4. Implement user management page
5. Add comprehensive tests for admin functionality
