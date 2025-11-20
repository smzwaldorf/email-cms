/**
 * Database Type Definitions
 * Corresponds to the CMS database schema (specs/002-database-structure/contracts/schema.sql)
 * These types represent the actual database entities from PostgreSQL via Supabase
 */

// ============================================================================
// Newsletter Weeks (週次)
// ============================================================================

export interface NewsletterWeekRow {
  /** Format: "YYYY-Www" (e.g., "2025-W47") - ISO 8601 week format */
  week_number: string;
  /** Expected publication date */
  release_date: string; // DATE
  /** Controls visibility to public */
  is_published: boolean;
  /** Auto-managed creation timestamp */
  created_at: string; // TIMESTAMP WITH TIME ZONE
  /** Auto-updated on any change */
  updated_at: string; // TIMESTAMP WITH TIME ZONE
}

// ============================================================================
// Articles (文章)
// ============================================================================

export interface ArticleRow {
  /** UUID primary key */
  id: string;
  /** Foreign key to newsletter_weeks */
  week_number: string;
  /** Article headline */
  title: string;
  /** Markdown-formatted content */
  content: string;
  /** Author name (optional) */
  author?: string | null;
  /** Display sequence within week (1, 2, 3...) */
  article_order: number;
  /** Public visibility flag */
  is_published: boolean;
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
// Classes (班級)
// ============================================================================

export interface ClassRow {
  /** Class identifier (e.g., "A1", "B2") */
  id: string; // VARCHAR(10) PRIMARY KEY
  /** Human-readable name (e.g., "Grade 1A") */
  class_name: string;
  /** Grade level (1-12) */
  class_grade_year: number;
  /** Creation timestamp */
  created_at: string; // TIMESTAMP WITH TIME ZONE
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
  /** Creation timestamp */
  created_at: string; // TIMESTAMP WITH TIME ZONE
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
  parent_id: string;
  /** Enum: 'father' | 'mother' | 'guardian' */
  relationship: 'father' | 'mother' | 'guardian';
  /** Enrollment timestamp */
  enrolled_at: string; // TIMESTAMP WITH TIME ZONE
}

// ============================================================================
// Child Class Enrollment (兒童班級註冊)
// Links children to classes they're enrolled in
// ============================================================================

export interface ChildClassEnrollmentRow {
  /** UUID primary key */
  id: string;
  /** Foreign key to user_roles (child's user ID, role = 'student') */
  child_id: string;
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
  | NewsletterWeekRow
  | ArticleRow
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
