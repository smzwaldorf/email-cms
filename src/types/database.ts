/**
 * Database Type Definitions
 * Corresponds to the CMS database schema (specs/002-database-structure/contracts/schema.sql)
 * These types represent the actual database entities from PostgreSQL via Supabase
 */

// ============================================================================
// Newsletters (電子報)
// ============================================================================

export interface NewsletterRow {
  /** UUID primary key */
  id: string;
  /** Optional: Format "YYYY-Www" (e.g., "2025-W47") - ISO 8601 week format */
  week_number?: string | null;
  /** Newsletter headline */
  title?: string | null;
  /** Newsletter summary/description */
  description?: string | null;
  /** Expected publication date */
  release_date: string; // DATE
  /** Newsletter status: draft, published, or archived */
  status: 'draft' | 'published' | 'archived';
  /** Whether this newsletter record is a reusable template */
  is_template?: boolean;
  /** Timestamp when the newsletter was published */
  published_at?: string | null; // TIMESTAMP WITH TIME ZONE
  /** Auto-managed creation timestamp */
  created_at: string; // TIMESTAMP WITH TIME ZONE
  /** Auto-updated on any change */
  updated_at: string; // TIMESTAMP WITH TIME ZONE
}

/** @deprecated Use NewsletterRow instead */
export type NewsletterWeekRow = NewsletterRow;

// ============================================================================
// Articles (文章)
// ============================================================================

export interface ArticleRow {
  /** UUID primary key */
  id: string;
  /** Article headline */
  title: string;
  /** Markdown-formatted content */
  content: string;
  /** UUID of the teacher/admin who wrote the article */
  author_id?: string | null;
  /** Article status: draft, published, or archived */
  status: 'draft' | 'published' | 'archived';
  /** Enum: 'public' | 'class_restricted' */
  visibility_type: 'public' | 'class_restricted';
  /** JSON array of class IDs if visibility_type = 'class_restricted' */
  restricted_to_classes?: string[] | null; // JSONB
  /** UUID of creator user */
  created_by?: string | null;
  /** Creation timestamp */
  created_at: string; // TIMESTAMP WITH TIME ZONE
  /** Last modification timestamp (auto-updated via trigger) */
  updated_at: string; // TIMESTAMP WITH TIME ZONE
  /** Soft-delete marker (null = active, timestamp = deleted) */
  deleted_at?: string | null; // TIMESTAMP WITH TIME ZONE
  /** Unique short ID for URL sharing */
  short_id: string; // VARCHAR(10)
}

// ============================================================================
// Newsletter Articles Junction Table (文章-電子報關聯)
// Enables many-to-many relationship between articles and newsletters
// ============================================================================

export interface NewsletterArticleRow {
  /** UUID primary key */
  id: string;
  /** Foreign key to newsletters (UUID) */
  newsletter_id: string;
  /** Foreign key to articles */
  article_id: string;
  /** Position within this specific newsletter (1-based) */
  article_order: number;
  /** Audience targeting mode for this article within newsletter */
  targeting_mode?: 'shared' | 'targeted';
  /** Class IDs allowed when targeting_mode = targeted */
  target_class_ids?: string[] | null;
  /** Timestamp when article was added to this newsletter */
  added_at: string; // TIMESTAMP WITH TIME ZONE
  /** UUID of user who added the article to this newsletter */
  added_by?: string | null;
}

/**
 * Article with all its newsletter associations
 * Used when querying articles with their newsletter placements
 */
export interface ArticleWithNewsletters extends ArticleRow {
  /** All newsletters this article belongs to */
  newsletters: Array<{
    newsletter_id: string;
    article_order: number;
    week_number?: string | null;
    title?: string | null;
    release_date?: string;
    status?: 'draft' | 'published' | 'archived';
  }>;
}

// ============================================================================
// Classes (班級)
// ============================================================================

export interface ClassRow {
  /** Class identifier (e.g., "A1", "B2") */
  id: string; // VARCHAR(10) PRIMARY KEY
  /** Stable class identity code used by admin workflows */
  class_code: string;
  /** Human-readable name (e.g., "Grade 1A") */
  class_name: string;
  /** Optional class description shown in admin UI */
  description?: string | null;
  /** Grade level (1-12) */
  class_grade_year: number;
  /** Lifecycle status */
  is_active: boolean;
  /** Deactivation timestamp for inactive classes */
  deactivated_at?: string | null;
  /** Creation timestamp */
  created_at: string; // TIMESTAMP WITH TIME ZONE
  /** Last update timestamp */
  updated_at?: string; // TIMESTAMP WITH TIME ZONE
}

// ============================================================================
// User Roles (使用者)
// ============================================================================

export interface UserRoleRow {
  /** UUID - references Supabase auth.users */
  id: string;
  /** User email address */
  email: string;
  /** Enum: 'admin' | 'teacher' | 'parent' | 'student' */
  role: 'admin' | 'teacher' | 'parent' | 'student';
  /** Creation timestamp */
  created_at: string; // TIMESTAMP WITH TIME ZONE
  /** Last update timestamp */
  updated_at: string; // TIMESTAMP WITH TIME ZONE
}

// ============================================================================
// Families (家庭)
// ============================================================================

export interface FamilyRow {
  /** UUID primary key */
  id: string;
  /** Unique enrollment code for parents to join */
  family_code: string;
  /** Optional display name for admin UI */
  family_name?: string | null;
  /** Guardian contact email */
  guardian_email?: string | null;
  /** Optional free-form description */
  description?: string | null;
  /** Related topic labels */
  related_topics?: string[] | null;
  /** Lifecycle status */
  is_active?: boolean;
  /** Deactivation timestamp */
  deactivated_at?: string | null;
  /** Creation timestamp */
  created_at: string; // TIMESTAMP WITH TIME ZONE
  /** Last update timestamp */
  updated_at?: string;
}

// ============================================================================
// Family Enrollment (家庭成員)
// Links parents to families
// ============================================================================

export interface FamilyEnrollmentRow {
  /** UUID primary key */
  id: string;
  /** Foreign key to families */
  family_id: string;
  /** Foreign key to user_roles (parent's user ID) */
  parent_id?: string | null;
  /** Foreign key to students (student ID) */
  student_id?: string | null;
  /** Enum: parent/student relationship */
  relationship: 'father' | 'mother' | 'guardian' | 'child' | 'student';
  /** Enrollment timestamp */
  enrolled_at: string; // TIMESTAMP WITH TIME ZONE
}

// ============================================================================
// Student (學生)
// ============================================================================

export interface StudentRow {
  id: string;
  name: string;
  student_code: string;
  is_active: boolean;
  deactivated_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Student Class Enrollment (學生班級註冊)
// ============================================================================

export interface ChildClassEnrollmentRow {
  /** UUID primary key */
  id: string;
  /** Legacy foreign key name retained for compatibility */
  child_id?: string;
  /** Foreign key to students (student ID) */
  student_id: string;
  /** Foreign key to families - links back to family */
  family_id: string;
  /** Foreign key to classes */
  class_id: string;
  /** Enrollment timestamp */
  enrolled_at: string; // TIMESTAMP WITH TIME ZONE
  /** Graduation timestamp (null = still enrolled) */
  graduated_at?: string | null; // TIMESTAMP WITH TIME ZONE
}

// ============================================================================
// Teacher Class Assignment (教師班級分派)
// Assigns teachers to classes for edit permissions
// ============================================================================

export interface TeacherClassAssignmentRow {
  /** UUID primary key */
  id: string;
  /** Foreign key to user_roles (teacher's user ID, role = 'teacher') */
  teacher_id: string;
  /** Foreign key to classes */
  class_id: string;
  /** Assignment timestamp */
  assigned_at: string; // TIMESTAMP WITH TIME ZONE
}

// ============================================================================
// Article Audit Log (文章審計日誌)
// Complete audit trail of article modifications
// ============================================================================

export interface ArticleAuditLogRow {
  /** UUID primary key */
  id: string;
  /** Foreign key to articles */
  article_id: string;
  /** Enum: 'create' | 'update' | 'publish' | 'unpublish' | 'delete' */
  action: 'create' | 'update' | 'publish' | 'unpublish' | 'delete';
  /** UUID of user who made the change */
  changed_by?: string | null;
  /** Previous field values (JSON representation of entire row) */
  old_values?: Record<string, unknown> | null; // JSONB
  /** New field values (JSON representation of entire row) */
  new_values?: Record<string, unknown> | null; // JSONB
  /** Timestamp of change */
  changed_at: string; // TIMESTAMP WITH TIME ZONE
}

// ============================================================================
// Database Schema Union Types
// ============================================================================

/** All database table row types */
export type DatabaseRow =
  | StudentRow
  | NewsletterWeekRow
  | ArticleRow
  | NewsletterArticleRow
  | ClassRow
  | UserRoleRow
  | FamilyRow
  | FamilyEnrollmentRow
  | ChildClassEnrollmentRow
  | TeacherClassAssignmentRow
  | ArticleAuditLogRow;

// ============================================================================
// Helper Types for Common Query Results
// ============================================================================

/**
 * Result of fetching articles for a specific week
 */
export interface WeeklyArticlesResult {
  week: NewsletterWeekRow;
  articles: ArticleRow[];
}

/**
 * Article with expanded class information
 */
export interface ArticleWithClasses extends ArticleRow {
  classes?: ClassRow[];
}

/**
 * Parent's family context with children and their classes
 */
export interface ParentFamilyContext {
  family: FamilyRow;
  parent: UserRoleRow;
  children: Array<{
    child: UserRoleRow;
    enrollments: Array<ChildClassEnrollmentRow & { class: ClassRow }>;
  }>;
}

/**
 * Teacher's assignment context with classes and articles
 */
export interface TeacherAssignmentContext {
  teacher: UserRoleRow;
  assignments: Array<TeacherClassAssignmentRow & { class: ClassRow }>;
}

/**
 * Complete article edit context
 */
export interface ArticleEditContext {
  article: ArticleRow;
  week: NewsletterWeekRow;
  auditLog: ArticleAuditLogRow[];
  canEdit: boolean;
  editReason?: string; // 'creator' | 'admin' | 'assigned_teacher'
}

// ============================================================================
// Supabase Integration Helpers
// ============================================================================

/**
 * Options for fetching articles with filters
 */
export interface FetchArticlesOptions {
  weekNumber?: string;
  classId?: string;
  isPublished?: boolean;
  visibilityType?: 'public' | 'class_restricted';
  excludeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Options for querying user permissions
 */
export interface UserPermissionsOptions {
  userId: string;
  articleId?: string;
  weekNumber?: string;
  classId?: string;
}

/**
 * Audit log entry metadata
 */
export interface AuditLogMetadata {
  action: 'create' | 'update' | 'publish' | 'unpublish' | 'delete';
  changedBy: string; // User ID
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  timestamp?: string;
}
