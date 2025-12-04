/**
 * Admin Dashboard Types
 * 管理員儀表板相關的型別定義
 *
 * 包含：用戶、班級、家族、分類、家長-學生關係、審計日誌等
 */

/**
 * Admin User (系統管理員)
 */
export interface AdminUser {
  id: string // UUID
  email: string
  name: string
  role: 'admin' | 'teacher' | 'parent' | 'student'
  status: 'active' | 'disabled' | 'pending_approval'
  createdAt: string
  updatedAt: string
  lastLoginAt?: string | null
}

/**
 * Class (班級)
 * 用於組織學生和發布課程內容
 */
export interface Class {
  id: string // UUID
  name: string // 班級名稱（例如：6年級A班、高二英文班）
  description?: string
  studentIds: string[] // 學生 ID 列表
  createdAt: string
  updatedAt: string
}

/**
 * Family (家族/相關主題)
 * 用於分組相關文章的主題集合
 */
export interface Family {
  id: string // UUID
  name: string // 家族名稱（例如：升學進路、親子教育）
  description?: string
  relatedTopics?: string[] // 相關主題清單
  createdAt: string
  updatedAt: string
}

/**
 * Article Class (文章分類)
 * 用於對文章進行分類（例如：科學、歷史、藝術）
 */
export interface ArticleClass {
  id: string // UUID
  name: string // 分類名稱
  description?: string
  createdAt: string
  updatedAt: string
}

/**
 * Parent-Student Relationship
 * 家長與學生之間的關係（可以是一對一或一對多）
 */
export interface ParentStudentRelationship {
  id: string // UUID
  parentId: string // 家長用戶 ID
  studentId: string // 學生用戶 ID
  relationship?: string // 關係描述（例如：父、母、監護人）
  createdAt: string
  updatedAt: string
}

/**
 * Audit Log Entry (審計日誌)
 * 記錄所有管理操作以進行安全審計
 */
export interface AuditLogEntry {
  id: string // UUID
  userId: string | null // 執行操作的用戶 ID（可能為空，用於系統操作）
  action: 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout'
  resourceType: 'user' | 'article' | 'class' | 'family' | 'newsletter' | 'relationship'
  resourceId: string | null // 受影響的資源 ID
  changes?: Record<string, any> // 變更前後的值（用於 update 操作）
  timestamp: string
  ipAddress?: string | null
  userAgent?: string | null
  details?: Record<string, any> // 額外的上下文訊息
}

/**
 * Newsletter Status
 * 電子報的發佈狀態
 */
export type NewsletterStatus = 'draft' | 'published' | 'archived'

/**
 * Admin Newsletter (用於管理面板的電子報視圖)
 */
export interface AdminNewsletter {
  id: string // UUID
  weekNumber: string // ISO 格式週次（例如：2025-W48）
  releaseDate: string // ISO 日期字符串
  status: NewsletterStatus
  articleCount: number // 該週的文章數量
  createdAt: string
  updatedAt: string
  publishedAt?: string | null
  isPublished: boolean
}

/**
 * Admin Article (用於管理面板的文章編輯視圖)
 */
export interface AdminArticle {
  id: string
  title: string
  content: string // HTML 格式
  author?: string
  summary?: string
  weekNumber: string
  order: number
  classIds?: string[] // 分類 ID 列表
  familyIds?: string[] // 家族 ID 列表
  status: 'draft' | 'published'
  createdAt: string
  updatedAt: string
  lastEditedBy?: string // 最後編輯者 ID
  editedAt?: string // 最後編輯時間（用於 LWW 衝突解決）
}

/**
 * Conflict Resolution Strategy
 * Last-Write-Wins (LWW) metadata for concurrent edit resolution
 */
export interface LWWMetadata {
  lastEditedBy: string // 用戶 ID
  editedAt: string // ISO 時間戳
  version: number // 版本號（可選）
}

/**
 * Form validation error
 */
export interface FormError {
  field: string
  message: string
}

/**
 * API Response wrapper
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, any>
  }
}

/**
 * User role permissions matrix
 */
export const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  admin: [
    'view_dashboard',
    'manage_newsletters',
    'manage_articles',
    'manage_users',
    'manage_classes',
    'manage_families',
    'view_audit_logs',
    'manage_roles',
    'batch_import_users',
  ] as const,
  teacher: ['view_articles', 'view_classes'] as const,
  parent: ['view_articles', 'view_children', 'view_class_content'] as const,
  student: [] as const, // 學生帳戶用於班級和家庭關聯，不登入系統
}

/**
 * User roles
 */
export type UserRole = keyof typeof ROLE_PERMISSIONS

/**
 * Check if user has permission
 */
export function hasPermission(
  userRole: UserRole,
  permission: string
): boolean {
  const permissions = ROLE_PERMISSIONS[userRole] || []
  return permissions.includes(permission as any)
}

/**
 * Newsletter filter options
 */
export interface NewsletterFilterOptions {
  status?: NewsletterStatus
  startDate?: string
  endDate?: string
  searchTerm?: string
  sortBy?: 'date' | 'status' | 'articleCount'
  sortOrder?: 'asc' | 'desc'
}

/**
 * User import CSV row
 */
export interface UserImportRow {
  email: string
  name: string
  role: UserRole
  status?: 'active' | 'disabled' | 'pending_approval'
}

/**
 * Batch import result summary
 */
export interface BatchImportSummary {
  totalRows: number
  successCount: number
  failureCount: number
  errors: Array<{
    rowNumber: number
    error: string
  }>
}
