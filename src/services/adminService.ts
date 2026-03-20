/**
 * Admin Service
 * Handles CRUD operations for admin dashboard (newsletters, articles, classes, families, users)
 *
 * Features:
 * - Newsletter management (create, read, update, delete, publish, archive)
 * - Article management with Last-Write-Wins conflict resolution
 * - Class and Family management
 * - User management with role assignment
 * - Relationship management for parent-student connections
 */

import { getSupabaseClient } from '@/lib/supabase'
import { articleMediaManager } from '@/services/articleMediaManager'
import {
  type AccessControlRole as ResolverRole,
  resolveAccessControl,
  resolveWinningRole,
} from '@/services/accessControlResolver'
import type {
  AdminNewsletter,
  AdminArticle,
  AdminRecycleBinArticle,
  Class,
  Family,
  AdminUser,
  ParentStudentRelationship,
  NewsletterFilterOptions,
  NewsletterPublishReadiness,
  ArticleCategory,
  ArticleTag,
  ArticleRevision,
  AccessControlRole,
  AccessControlSummary,
  BulkPermissionPreviewEntry,
  BulkPermissionApplyResult,
  AccessControlLogEntry,
} from '@/types/admin'

/**
 * Admin Service Error
 */
export class AdminServiceError extends Error {
  constructor(
    message: string,
    public code: string = 'ADMIN_ERROR',
    public originalError?: Error
  ) {
    super(message)
    this.name = 'AdminServiceError'
  }
}

export interface FetchClassesOptions {
  includeInactive?: boolean
}

interface ClassWriteOptions {
  code?: string
  gradeYear?: number
  actorId?: string
}

export interface FetchTeachersOptions {
  includeInactive?: boolean
}

export interface FetchFamiliesOptions {
  includeInactive?: boolean
}

export interface FetchStudentsOptions {
  includeInactive?: boolean
}

export interface FetchArticleTaxonomyOptions {
  includeInactive?: boolean
}

interface FamilyWriteOptions {
  actorId?: string
}

interface StudentWriteOptions {
  actorId?: string
}

export interface TeacherAssignedClass {
  id: string
  name: string
  isActive: boolean
}

interface TeacherWriteOptions {
  actorId?: string
}

interface AccessControlWriteOptions {
  actorId?: string
  auditAction?: 'single_update' | 'bulk_update' | 'class_scope_update'
  metadata?: Record<string, unknown>
}

interface FetchAccessControlLogOptions {
  targetUserId?: string
  action?: string
  from?: string
  to?: string
  limit?: number
}

const ACCESS_CONTROL_ROLES: AccessControlRole[] = ['admin', 'teacher', 'parent', 'student']

const REVISION_TRACKED_FIELDS = [
  'title',
  'summary',
  'content',
  'status',
  'visibility_type',
  'restricted_to_classes',
  'author_id',
  'deleted_at',
] as const

const REVISION_FIELD_LABELS: Record<(typeof REVISION_TRACKED_FIELDS)[number], string> = {
  title: '標題',
  summary: '摘要',
  content: '內容',
  status: '狀態',
  visibility_type: '可見性',
  restricted_to_classes: '班級限制',
  author_id: '作者',
  deleted_at: '刪除狀態',
}

const ARTICLE_RECYCLE_BIN_RETENTION_DAYS = 30

/**
 * Admin Service
 * Provides methods for admin dashboard operations
 */
class AdminService {
  private async getCurrentAuthUserId(): Promise<string | null> {
    const supabase = getSupabaseClient()
    if (!(supabase as any).auth?.getUser) return null
    const authResult = await (supabase as any).auth.getUser()
    return authResult?.data?.user?.id ?? null
  }

  private normalizeClassCode(input: string): string {
    return input.trim().toUpperCase()
  }

  private isMissingRelationError(error: any): boolean {
    if (!error) return false
    return error.code === '42P01' || String(error.message || '').includes('does not exist')
  }

  private dedupeClassIds(classIds: string[]): string[] {
    return Array.from(new Set((classIds || []).map((id) => id.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }

  private normalizeAccessRoles(roles: AccessControlRole[]): AccessControlRole[] {
    const uniqueRoles = Array.from(new Set((roles || []).filter((role) => ACCESS_CONTROL_ROLES.includes(role))))
    const winner = resolveWinningRole(uniqueRoles as ResolverRole[])
    if (!winner) return ['student']

    const precedence = ['admin', 'teacher', 'parent', 'student']
    return precedence.filter((role) => uniqueRoles.includes(role as AccessControlRole)) as AccessControlRole[]
  }

  private buildAccessControlSummary(
    roles: AccessControlRole[],
    classIds: string[],
  ): AccessControlSummary {
    const normalizedRoles = this.normalizeAccessRoles(roles)
    const teacherClassIds = normalizedRoles.includes('teacher') ? this.dedupeClassIds(classIds) : []
    const resolution = resolveAccessControl({
      roles: normalizedRoles as ResolverRole[],
      action: 'article:view',
      teacherClassIds,
    })

    return {
      roles: resolution.evaluatedRoles as AccessControlRole[],
      winningRole: (resolution.winningRole || 'student') as AccessControlRole,
      readClassIds: resolution.scope.readClassIds,
      writeClassIds: resolution.scope.writeClassIds,
      policyVersion: resolution.policyVersion,
    }
  }

  private async loadRoleAssignments(userId: string, fallbackRole?: AccessControlRole): Promise<AccessControlRole[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('user_role_assignments')
      .select('role')
      .eq('user_id', userId)

    if (error) {
      if (!this.isMissingRelationError(error)) {
        console.warn(`Failed to load user_role_assignments for ${userId}:`, error)
      }
      return fallbackRole ? [fallbackRole] : ['student']
    }

    const roles = (data || []).map((row: any) => row.role as AccessControlRole)
    if (roles.length === 0) {
      return fallbackRole ? [fallbackRole] : ['student']
    }

    return this.normalizeAccessRoles(roles)
  }

  private async saveRoleAssignments(userId: string, roles: AccessControlRole[]): Promise<void> {
    const supabase = getSupabaseClient()
    const normalizedRoles = this.normalizeAccessRoles(roles)

    const { error: deleteError } = await supabase
      .from('user_role_assignments')
      .delete()
      .eq('user_id', userId)

    if (deleteError && !this.isMissingRelationError(deleteError)) {
      throw new AdminServiceError(
        `Failed to clear role assignments: ${deleteError.message}`,
        'UPDATE_USER_ACCESS_ERROR',
        deleteError as any
      )
    }

    if (deleteError && this.isMissingRelationError(deleteError)) {
      return
    }

    const { error: insertError } = await supabase
      .from('user_role_assignments')
      .insert(normalizedRoles.map((role) => ({ user_id: userId, role })))

    if (insertError) {
      if (this.isMissingRelationError(insertError)) return
      throw new AdminServiceError(
        `Failed to save role assignments: ${insertError.message}`,
        'UPDATE_USER_ACCESS_ERROR',
        insertError as any
      )
    }
  }

  private async fetchTeacherClassIdsInternal(userId: string): Promise<string[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('teacher_class_assignment')
      .select('class_id')
      .eq('teacher_id', userId)

    if (error) {
      throw new AdminServiceError(
        `Failed to fetch teacher class restrictions: ${error.message}`,
        'FETCH_USER_CLASS_SCOPE_ERROR',
        error as any
      )
    }

    return this.dedupeClassIds((data || []).map((row: any) => row.class_id))
  }

  private async saveTeacherClassIdsInternal(userId: string, classIds: string[]): Promise<void> {
    const supabase = getSupabaseClient()
    const nextClassIds = this.dedupeClassIds(classIds)
    const currentClassIds = await this.fetchTeacherClassIdsInternal(userId)

    const toRemove = currentClassIds.filter((id) => !nextClassIds.includes(id))
    const toAdd = nextClassIds.filter((id) => !currentClassIds.includes(id))

    if (toRemove.length > 0) {
      const { error: removeError } = await supabase
        .from('teacher_class_assignment')
        .delete()
        .eq('teacher_id', userId)
        .in('class_id', toRemove)

      if (removeError) {
        throw new AdminServiceError(
          `Failed to remove teacher class restrictions: ${removeError.message}`,
          'UPDATE_USER_CLASS_SCOPE_ERROR',
          removeError as any
        )
      }
    }

    if (toAdd.length > 0) {
      const { error: addError } = await supabase
        .from('teacher_class_assignment')
        .insert(toAdd.map((classId) => ({ teacher_id: userId, class_id: classId })))

      if (addError) {
        throw new AdminServiceError(
          `Failed to add teacher class restrictions: ${addError.message}`,
          'UPDATE_USER_CLASS_SCOPE_ERROR',
          addError as any
        )
      }
    }
  }

  private async writePermissionMutationAudit(
    targetUserId: string,
    action: 'single_update' | 'bulk_update' | 'class_scope_update',
    beforeState: Record<string, unknown>,
    afterState: Record<string, unknown>,
    metadata: Record<string, unknown> = {},
    actorId?: string,
  ): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('permission_mutation_audit_log')
      .insert({
        actor_id: actorId || null,
        target_user_id: targetUserId,
        action,
        before_state: beforeState,
        after_state: afterState,
        metadata,
      })

    if (error && !this.isMissingRelationError(error)) {
      throw new AdminServiceError(
        `Failed to write access-control audit log: ${error.message}`,
        'ACCESS_CONTROL_AUDIT_WRITE_ERROR',
        error as any
      )
    }
  }

  private mapArticleCategoryRow(row: any): ArticleCategory {
    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      isActive: row.is_active ?? true,
      createdAt: row.created_at,
      updatedAt: row.updated_at || row.created_at,
      deactivatedAt: row.deactivated_at ?? null,
    }
  }

  private mapArticleTagRow(row: any): ArticleTag {
    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      isActive: row.is_active ?? true,
      createdAt: row.created_at,
      updatedAt: row.updated_at || row.created_at,
      deactivatedAt: row.deactivated_at ?? null,
    }
  }

  private mapAdminArticleRow(row: any, fallbackWeekNumber: string = ''): AdminArticle {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      author: row.author_id,
      summary: row.summary,
      weekNumber: row.week_number || fallbackWeekNumber,
      order: row.article_order || 0,
      classIds: row.class_ids || [],
      familyIds: row.family_ids || [],
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? null,
      deletedBy: row.deleted_by ?? null,
      purgeScheduledAt: row.purge_scheduled_at ?? null,
      publishedAt: row.published_at,
      lastEditedBy: row.last_edited_by,
      editedAt: row.edited_at,
    }
  }

  private computeArticlePurgeScheduledAt(deletedAt: string): string {
    const deletedAtMillis = new Date(deletedAt).getTime()
    if (Number.isNaN(deletedAtMillis)) {
      return new Date().toISOString()
    }
    const retentionWindowMillis = ARTICLE_RECYCLE_BIN_RETENTION_DAYS * 24 * 60 * 60 * 1000
    return new Date(deletedAtMillis + retentionWindowMillis).toISOString()
  }

  private formatRevisionValue(value: unknown, field: string): string {
    if (value === null || value === undefined) return '（空）'

    if (field === 'content' && typeof value === 'string') {
      const normalized = value.replace(/\s+/g, ' ').trim()
      return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized
    }

    if (Array.isArray(value)) {
      return value.length === 0 ? '（空）' : value.join(', ')
    }

    if (typeof value === 'object') {
      return JSON.stringify(value)
    }

    const strValue = String(value)
    return strValue.trim() === '' ? '（空）' : strValue
  }

  private buildRevisionDiffs(
    oldValues?: Record<string, unknown> | null,
    newValues?: Record<string, unknown> | null,
  ) {
    const before = oldValues || {}
    const after = newValues || {}

    const diffs = REVISION_TRACKED_FIELDS
      .filter((field) => {
        const beforeValue = before[field]
        const afterValue = after[field]
        return JSON.stringify(beforeValue ?? null) !== JSON.stringify(afterValue ?? null)
      })
      .map((field) => ({
        field,
        label: REVISION_FIELD_LABELS[field],
        before: this.formatRevisionValue(before[field], field),
        after: this.formatRevisionValue(after[field], field),
      }))

    return diffs
  }

  private getRevisionActionLabel(action: string): string {
    switch (action) {
      case 'create':
        return '建立文章'
      case 'update':
        return '更新內容'
      case 'publish':
        return '發布文章'
      case 'unpublish':
        return '取消發布'
      case 'delete':
        return '刪除文章'
      default:
        return '變更'
    }
  }

  private async validateTaxonomyIds(
    tableName: 'article_categories' | 'article_tags',
    ids: string[]
  ): Promise<void> {
    if (ids.length === 0) return

    const supabase = getSupabaseClient()
    const idField = tableName === 'article_categories' ? 'category_id' : 'tag_id'

    const { data, error } = await supabase
      .from(tableName)
      .select('id')
      .in('id', ids)
      .eq('is_active', true)

    if (error) {
      throw new AdminServiceError(
        `Failed to validate taxonomy IDs: ${error.message}`,
        'ARTICLE_TAXONOMY_VALIDATION_ERROR',
        error as any
      )
    }

    const existingIds = new Set((data || []).map((row: any) => row.id))
    const unknownIds = ids.filter((id) => !existingIds.has(id))

    if (unknownIds.length > 0) {
      throw new AdminServiceError(
        `Unknown ${idField.replace('_id', '')} IDs: ${unknownIds.join(', ')}`,
        'ARTICLE_TAXONOMY_VALIDATION_ERROR'
      )
    }
  }

  private async validateTeacherWriteInput(input: {
    idToExclude?: string
    email?: string
    name?: string
  }): Promise<void> {
    const fieldErrors: Record<string, string> = {}
    const normalizedEmail = (input.email || '').trim().toLowerCase()
    const normalizedName = (input.name || '').trim()

    if (!normalizedEmail) {
      fieldErrors.email = '教師電子郵件為必填項'
    }
    if (!normalizedName) {
      fieldErrors.name = '教師姓名為必填項'
    }

    if (Object.keys(fieldErrors).length > 0) {
      throw new AdminServiceError(
        JSON.stringify({ fieldErrors }),
        'TEACHER_VALIDATION_ERROR'
      )
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('user_roles')
      .select('id, role')
      .ilike('email', normalizedEmail)

    if (error) {
      throw new AdminServiceError(
        `Failed to validate teacher uniqueness: ${error.message}`,
        'TEACHER_VALIDATION_ERROR',
        error as any
      )
    }

    const duplicate = (data || []).find((row: any) => row.id !== input.idToExclude)
    if (duplicate) {
      throw new AdminServiceError(
        JSON.stringify({ fieldErrors: { email: '教師電子郵件已存在' } }),
        'TEACHER_VALIDATION_ERROR'
      )
    }
  }

  private async writeTeacherAudit(
    teacherId: string,
    action: 'create' | 'update' | 'activate' | 'deactivate',
    priorState: Record<string, unknown> | null,
    newState: Record<string, unknown> | null,
    actorId?: string,
  ): Promise<void> {
    try {
      const supabase = getSupabaseClient()
      const resolvedActorId = actorId || await this.getCurrentAuthUserId()
      await supabase.from('teacher_audit_log').insert({
        teacher_id: teacherId,
        action,
        actor_id: resolvedActorId,
        prior_state: priorState,
        new_state: newState,
      })
    } catch (error) {
      console.error('Failed to log teacher audit event:', error)
    }
  }

  private async validateClassWriteInput(input: {
    idToExclude?: string
    name?: string
    code?: string
    gradeYear?: number
  }): Promise<void> {
    const fieldErrors: Record<string, string> = {}

    if (!input.name || input.name.trim() === '') {
      fieldErrors.name = '班級名稱為必填項'
    }
    if (!input.code || input.code.trim() === '') {
      fieldErrors.code = '班級代碼為必填項'
    }
    if (typeof input.gradeYear !== 'number' || Number.isNaN(input.gradeYear)) {
      fieldErrors.gradeYear = '年級為必填項'
    } else if (input.gradeYear < 1 || input.gradeYear > 12) {
      fieldErrors.gradeYear = '年級必須介於 1 到 12'
    }

    if (Object.keys(fieldErrors).length > 0) {
      throw new AdminServiceError(
        JSON.stringify({ fieldErrors }),
        'CLASS_VALIDATION_ERROR'
      )
    }

    const supabase = getSupabaseClient()
    const normalizedCode = this.normalizeClassCode((input.code || '').trim())
    const normalizedName = (input.name || '').trim()

    const [codeCheck, nameCheck] = await Promise.all([
      supabase.from('classes').select('id').ilike('class_code', normalizedCode),
      supabase.from('classes').select('id').ilike('class_name', normalizedName),
    ])

    if (codeCheck.error || nameCheck.error) {
      throw new AdminServiceError(
        `Failed to validate class identity: ${codeCheck.error?.message || nameCheck.error?.message}`,
        'CLASS_VALIDATION_ERROR',
        (codeCheck.error || nameCheck.error) as any
      )
    }

    const duplicateCode = (codeCheck.data || []).find((row: any) => row.id !== input.idToExclude)
    if (duplicateCode) {
      throw new AdminServiceError(
        JSON.stringify({ fieldErrors: { code: '班級代碼已存在' } }),
        'CLASS_VALIDATION_ERROR'
      )
    }

    const duplicateName = (nameCheck.data || []).find((row: any) => row.id !== input.idToExclude)
    if (duplicateName) {
      throw new AdminServiceError(
        JSON.stringify({ fieldErrors: { name: '班級名稱已存在' } }),
        'CLASS_VALIDATION_ERROR'
      )
    }
  }

  private async writeClassAudit(
    classId: string,
    action: 'create' | 'update' | 'activate' | 'deactivate',
    priorState: Record<string, unknown> | null,
    newState: Record<string, unknown> | null,
    actorId?: string
  ): Promise<void> {
    try {
      const supabase = getSupabaseClient()
      let resolvedActorId = actorId || null
      if (!resolvedActorId && (supabase as any).auth?.getUser) {
        const authResult = await (supabase as any).auth.getUser()
        resolvedActorId = authResult?.data?.user?.id ?? null
      }

      await supabase.from('class_audit_log').insert({
        class_id: classId,
        action,
        actor_id: resolvedActorId,
        prior_state: priorState,
        new_state: newState,
      })
    } catch (error) {
      // Class operations should not fail if audit logging is unavailable.
      console.error('Failed to log class audit event:', error)
    }
  }

  private normalizeFamilyCode(input: string): string {
    return input
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-_]/g, '')
      .toUpperCase()
  }

  private async validateFamilyWriteInput(input: {
    idToExclude?: string
    name?: string
    guardianEmail?: string
  }): Promise<void> {
    const fieldErrors: Record<string, string> = {}
    const normalizedName = (input.name || '').trim()
    const normalizedEmail = (input.guardianEmail || '').trim().toLowerCase()

    if (!normalizedName) {
      fieldErrors.name = '家族名稱為必填項'
    }
    if (!normalizedEmail) {
      fieldErrors.guardianEmail = '監護人電子郵件為必填項'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      fieldErrors.guardianEmail = '監護人電子郵件格式不正確'
    }

    if (Object.keys(fieldErrors).length > 0) {
      throw new AdminServiceError(
        JSON.stringify({ fieldErrors }),
        'FAMILY_VALIDATION_ERROR'
      )
    }

    const supabase = getSupabaseClient()
    const normalizedCode = this.normalizeFamilyCode(normalizedName)
    const [codeCheck, emailCheck] = await Promise.all([
      supabase
        .from('families')
        .select('id')
        .eq('is_active', true)
        .ilike('family_code', normalizedCode),
      supabase
        .from('families')
        .select('id')
        .eq('is_active', true)
        .ilike('guardian_email', normalizedEmail),
    ])

    if (codeCheck.error || emailCheck.error) {
      throw new AdminServiceError(
        `Failed to validate family identity: ${codeCheck.error?.message || emailCheck.error?.message}`,
        'FAMILY_VALIDATION_ERROR',
        (codeCheck.error || emailCheck.error) as any
      )
    }

    const duplicateCode = (codeCheck.data || []).find((row: any) => row.id !== input.idToExclude)
    if (duplicateCode) {
      throw new AdminServiceError(
        JSON.stringify({ fieldErrors: { name: '家族名稱已存在' } }),
        'FAMILY_VALIDATION_ERROR'
      )
    }

    const duplicateEmail = (emailCheck.data || []).find((row: any) => row.id !== input.idToExclude)
    if (duplicateEmail) {
      throw new AdminServiceError(
        JSON.stringify({ fieldErrors: { guardianEmail: '監護人電子郵件已存在' } }),
        'FAMILY_VALIDATION_ERROR'
      )
    }
  }

  private mapFamilyRow(row: any): Family {
    return {
      id: row.id,
      name: row.family_name || row.family_code || '',
      guardianEmail: row.guardian_email || '',
      description: row.description || '',
      relatedTopics: Array.isArray(row.related_topics) ? row.related_topics : [],
      isActive: row.is_active ?? true,
      deactivatedAt: row.deactivated_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at || row.created_at,
    }
  }

  private async writeFamilyAudit(
    familyId: string,
    action: 'create' | 'update' | 'activate' | 'deactivate' | 'add_child' | 'remove_child',
    priorState: Record<string, unknown> | null,
    newState: Record<string, unknown> | null,
    actorId?: string
  ): Promise<void> {
    try {
      const supabase = getSupabaseClient()
      const resolvedActorId = actorId || await this.getCurrentAuthUserId()
      await supabase.from('family_audit_log').insert({
        family_id: familyId,
        action,
        actor_id: resolvedActorId,
        prior_state: priorState,
        new_state: newState,
      })
    } catch (error) {
      console.error('Failed to log family audit event:', error)
    }
  }

  private normalizeTargeting(
    targetingMode: 'shared' | 'targeted' = 'shared',
    targetClassIds: string[] = []
  ): { targetingMode: 'shared' | 'targeted'; targetClassIds: string[] } {
    const uniqueClassIds = Array.from(new Set(targetClassIds.filter(Boolean)))
    if (targetingMode === 'shared') {
      return { targetingMode: 'shared', targetClassIds: [] }
    }
    return { targetingMode: 'targeted', targetClassIds: uniqueClassIds }
  }

  private async validateTargetClassIds(targetClassIds: string[]): Promise<void> {
    if (targetClassIds.length === 0) return

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('classes')
      .select('id')
      .in('id', targetClassIds)

    if (error) {
      throw new AdminServiceError(
        `Failed to validate target classes: ${error.message}`,
        'VALIDATION_ERROR',
        error as any
      )
    }

    const validIds = new Set((data || []).map((row: any) => row.id))
    const unknownIds = targetClassIds.filter((id) => !validIds.has(id))
    if (unknownIds.length > 0) {
      throw new AdminServiceError(
        `Unknown class IDs: ${unknownIds.join(', ')}`,
        'VALIDATION_ERROR'
      )
    }
  }

  private mapNewsletterRow(row: any, articleCount: number = 0): AdminNewsletter {
    return {
      id: row.id,
      weekNumber: row.week_number,
      title: row.title,
      description: row.description,
      releaseDate: row.release_date,
      status: row.status,
      isTemplate: row.is_template ?? false,
      articleCount,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: row.published_at,
      isPublished: row.status === 'published',
    }
  }

  /**
   * Helper: Get newsletter UUID by week_number
   */
  private async getNewsletterIdByWeek(weekNumber: string): Promise<string | null> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('newsletters')
      .select('id')
      .eq('week_number', weekNumber)
      .single()
    
    if (error || !data) return null
    return data.id
  }

  private async copyCompositionToNewsletter(
    sourceNewsletterId: string,
    targetNewsletter: AdminNewsletter
  ): Promise<number> {
    const supabase = getSupabaseClient()
    const { data: sourceArticles, error: sourceArticlesError } = await supabase
      .from('newsletter_articles')
      .select(`
        article_order,
        targeting_mode,
        target_class_ids,
        articles!inner (
          id,
          title,
          content,
          author_id,
          author,
          summary,
          visibility_type,
          restricted_to_classes,
          class_ids,
          family_ids
        )
      `)
      .eq('newsletter_id', sourceNewsletterId)
      .order('article_order', { ascending: true })

    if (sourceArticlesError) {
      throw new AdminServiceError(
        `Failed to fetch source articles: ${sourceArticlesError.message}`,
        'FETCH_ARTICLES_ERROR',
        sourceArticlesError as any
      )
    }

    if (!sourceArticles?.length) {
      return 0
    }

    const copiedArticlePayload = sourceArticles.map((row: any) => ({
      title: row.articles.title,
      content: row.articles.content,
      author_id: row.articles.author_id ?? null,
      author: row.articles.author ?? null,
      summary: row.articles.summary ?? null,
      status: 'draft',
      visibility_type: row.articles.visibility_type ?? 'public',
      restricted_to_classes: row.articles.restricted_to_classes ?? null,
      class_ids: row.articles.class_ids ?? [],
      family_ids: row.articles.family_ids ?? [],
      week_number: targetNewsletter.weekNumber ?? null,
      article_order: row.article_order,
      published_at: null,
      edited_at: null,
      last_edited_by: null,
    }))

    const { data: copiedArticles, error: copiedArticlesError } = await supabase
      .from('articles')
      .insert(copiedArticlePayload)
      .select('id')

    if (copiedArticlesError) {
      throw new AdminServiceError(
        `Failed to copy source articles: ${copiedArticlesError.message}`,
        'CREATE_ARTICLE_ERROR',
        copiedArticlesError as any
      )
    }

    const copiedLinks = (copiedArticles || []).map((article: any, index: number) => ({
      newsletter_id: targetNewsletter.id,
      article_id: article.id,
      article_order: sourceArticles[index].article_order,
      targeting_mode: sourceArticles[index].targeting_mode ?? 'shared',
      target_class_ids: sourceArticles[index].target_class_ids ?? [],
    }))

    const { error: linkError } = await supabase
      .from('newsletter_articles')
      .insert(copiedLinks)

    if (linkError) {
      throw new AdminServiceError(
        `Failed to attach copied articles: ${linkError.message}`,
        'ADD_ARTICLE_TO_NEWSLETTER_ERROR',
        linkError as any
      )
    }

    // Preserve media references and usage ledger when copying articles.
    const referenceInserts: Array<{
      article_id: string
      media_id: string
      reference_type: string
      position: number
    }> = []

    for (let index = 0; index < (copiedArticles || []).length; index++) {
      const sourceArticleId = sourceArticles[index]?.articles?.id
      const copiedArticleId = copiedArticles?.[index]?.id
      if (!sourceArticleId || !copiedArticleId) continue

      const { data: sourceReferences, error: sourceReferencesError } = await supabase
        .from('article_media_references')
        .select('media_id, reference_type, position')
        .eq('article_id', sourceArticleId)

      if (sourceReferencesError) {
        throw new AdminServiceError(
          `Failed to fetch source media references: ${sourceReferencesError.message}`,
          'FETCH_ARTICLE_MEDIA_REFERENCES_ERROR',
          sourceReferencesError as any
        )
      }

      for (const ref of sourceReferences || []) {
        referenceInserts.push({
          article_id: copiedArticleId,
          media_id: ref.media_id,
          reference_type: ref.reference_type ?? 'inline',
          position: ref.position ?? 0,
        })
      }

      await articleMediaManager.copyArticleMediaUsage(sourceArticleId, copiedArticleId)
    }

    if (referenceInserts.length > 0) {
      const { error: referencesInsertError } = await supabase
        .from('article_media_references')
        .insert(referenceInserts)

      if (referencesInsertError) {
        throw new AdminServiceError(
          `Failed to copy article media references: ${referencesInsertError.message}`,
          'COPY_ARTICLE_MEDIA_REFERENCES_ERROR',
          referencesInsertError as any
        )
      }
    }

    return copiedLinks.length
  }

  /**
   * ============ NEWSLETTER OPERATIONS ============
   */

  /**
   * Fetch all newsletters with optional filtering
   */
  async fetchNewsletters(
    filters?: NewsletterFilterOptions
  ): Promise<AdminNewsletter[]> {
    try {
      const supabase = getSupabaseClient()

      // Use newsletter_articles junction table for article count
      let query = supabase
        .from('newsletters')
        .select('*, newsletter_articles(count)')
        .order('week_number', { ascending: false })

      // Apply status filter
      if (filters?.status) {
        query = query.eq('status', filters.status)
      }

      // Apply date range filter
      if (filters?.startDate) {
        query = query.gte('release_date', filters.startDate)
      }
      if (filters?.endDate) {
        query = query.lte('release_date', filters.endDate)
      }

      // Apply search filter
      if (filters?.searchTerm) {
        query = query.or(
          `week_number.ilike.%${filters.searchTerm}%,title.ilike.%${filters.searchTerm}%`
        )
      }

      // Apply sorting
      const sortBy = filters?.sortBy || 'date'
      const sortOrder = filters?.sortOrder === 'asc'
      const sortField =
        sortBy === 'date'
          ? 'release_date'
          : sortBy === 'status'
            ? 'status'
            : 'article_count'

      query = query.order(sortField, { ascending: sortOrder })

      const { data, error } = await query

      if (error) {
        throw new AdminServiceError(
          `Failed to fetch newsletters: ${error.message}`,
          'FETCH_NEWSLETTERS_ERROR',
          error as any
        )
      }

      return (data || []).map((row: any) => this.mapNewsletterRow(
        row,
        row.newsletter_articles?.[0]?.count || 0
      ))
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching newsletters: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_NEWSLETTERS_ERROR',
        err as any
      )
    }
  }

  async fetchNewsletterTemplates(): Promise<AdminNewsletter[]> {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('newsletters')
        .select('*, newsletter_articles(count)')
        .eq('is_template', true)
        .order('updated_at', { ascending: false })

      if (error) {
        throw new AdminServiceError(
          `Failed to fetch newsletter templates: ${error.message}`,
          'FETCH_NEWSLETTERS_ERROR',
          error as any
        )
      }

      return (data || []).map((row: any) => this.mapNewsletterRow(
        row,
        row.newsletter_articles?.[0]?.count || 0
      ))
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching newsletter templates: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_NEWSLETTERS_ERROR',
        err as any
      )
    }
  }

  /**
   * Fetch single newsletter by ID
   */
  async fetchNewsletter(id: string): Promise<AdminNewsletter> {
    try {
      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .from('newsletters')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        throw new AdminServiceError(
          `Newsletter not found: ${id}`,
          'NEWSLETTER_NOT_FOUND',
          error as any
        )
      }

      return {
        id: data.id,
        weekNumber: data.week_number,
        title: data.title,
        description: data.description,
        releaseDate: data.release_date,
        status: data.status,
        isTemplate: data.is_template ?? false,
        articleCount: 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        publishedAt: data.published_at,
        isPublished: data.status === 'published',
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching newsletter: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_NEWSLETTER_ERROR',
        err as any
      )
    }
  }

  /**
   * Fetch single newsletter by Week Number
   */
  async fetchNewsletterByWeek(weekNumber: string): Promise<AdminNewsletter> {
    try {
      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .from('newsletters')
        .select('*, newsletter_articles(count)')
        .eq('week_number', weekNumber)
        .single()

      if (error) {
        throw new AdminServiceError(
          `Newsletter not found for week: ${weekNumber}`,
          'NEWSLETTER_NOT_FOUND',
          error as any
        )
      }

      return {
        id: data.id,
        weekNumber: data.week_number,
        title: data.title,
        description: data.description,
        releaseDate: data.release_date,
        status: data.status,
        isTemplate: data.is_template ?? false,
        articleCount: data.newsletter_articles?.[0]?.count || 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        publishedAt: data.published_at,
        isPublished: data.status === 'published',
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching newsletter: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_NEWSLETTER_ERROR',
        err as any
      )
    }
  }

  /**
   * Create new newsletter
   */
  async createNewsletter(
    weekNumber: string | null,
    releaseDate: string,
    metadata?: {
      title?: string | null
      description?: string | null
    }
  ): Promise<AdminNewsletter> {
    try {
      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .from('newsletters')
        .insert({
          week_number: weekNumber || null,
          title: metadata?.title?.trim() || null,
          description: metadata?.description?.trim() || null,
          release_date: releaseDate,
          status: 'draft',
          is_template: false,
        })
        .select()
        .single()

      if (error) {
        throw new AdminServiceError(
          `Failed to create newsletter: ${error.message}`,
          'CREATE_NEWSLETTER_ERROR',
          error as any
        )
      }

      return this.mapNewsletterRow(data, 0)
    } catch (err: any) {
      if (err instanceof AdminServiceError) throw err
      
      // Handle duplicate key error (Postgres code 23505)
      if (err?.code === '23505') {
        throw new AdminServiceError(
          `Newsletter for week ${weekNumber} already exists`,
          'DUPLICATE_NEWSLETTER_ERROR',
          err
        )
      }

      throw new AdminServiceError(
        `Error creating newsletter: ${err instanceof Error ? err.message : String(err)}`,
        'CREATE_NEWSLETTER_ERROR',
        err as any
      )
    }
  }

  async updateNewsletter(
    id: string,
    updates: {
      weekNumber?: string | null
      title?: string | null
      description?: string | null
      releaseDate?: string
    }
  ): Promise<AdminNewsletter> {
    try {
      const supabase = getSupabaseClient()

      const existing = await this.fetchNewsletter(id)
      if (existing.status !== 'draft') {
        throw new AdminServiceError(
          'Only draft newsletters can be updated',
          'NEWSLETTER_NOT_EDITABLE'
        )
      }

      const payload: Record<string, any> = {}
      if (updates.weekNumber !== undefined) payload.week_number = updates.weekNumber || null
      if (updates.title !== undefined) payload.title = updates.title?.trim() || null
      if (updates.description !== undefined) payload.description = updates.description?.trim() || null
      if (updates.releaseDate !== undefined) payload.release_date = updates.releaseDate

      const { data, error } = await supabase
        .from('newsletters')
        .update(payload)
        .eq('id', id)
        .select('*, newsletter_articles(count)')
        .single()

      if (error) {
        throw new AdminServiceError(
          `Failed to update newsletter: ${error.message}`,
          'UPDATE_NEWSLETTER_ERROR',
          error as any
        )
      }

      return this.mapNewsletterRow(data, data.newsletter_articles?.[0]?.count || 0)
    } catch (err: any) {
      if (err instanceof AdminServiceError) throw err

      if (err?.code === '23505') {
        throw new AdminServiceError(
          `Newsletter for week ${updates.weekNumber} already exists`,
          'DUPLICATE_NEWSLETTER_ERROR',
          err
        )
      }

      throw new AdminServiceError(
        `Error updating newsletter: ${err instanceof Error ? err.message : String(err)}`,
        'UPDATE_NEWSLETTER_ERROR',
        err as any
      )
    }
  }

  async getNewsletterPublishReadiness(id: string): Promise<NewsletterPublishReadiness> {
    const newsletter = await this.fetchNewsletter(id)
    const articles = await this.fetchArticlesByNewsletterId(id)
    const issues: string[] = []

    if (!newsletter.releaseDate) {
      issues.push('請設定發布日期')
    }

    if (!articles.length) {
      issues.push('至少需要一篇文章才能發布')
    }

    if (newsletter.status === 'archived') {
      issues.push('已封存的電子報無法直接發布')
    }

    return {
      canPublish: issues.length === 0,
      issues,
    }
  }

  async createTemplateFromNewsletter(
    sourceNewsletterId: string,
    metadata?: {
      title?: string | null
      description?: string | null
      releaseDate?: string
    }
  ): Promise<AdminNewsletter> {
    try {
      const supabase = getSupabaseClient()
      const { data: sourceNewsletter, error: sourceNewsletterError } = await supabase
        .from('newsletters')
        .select('*')
        .eq('id', sourceNewsletterId)
        .single()

      if (sourceNewsletterError || !sourceNewsletter) {
        throw new AdminServiceError(
          `Source newsletter not found: ${sourceNewsletterId}`,
          'NEWSLETTER_NOT_FOUND',
          sourceNewsletterError as any
        )
      }

      const { data: createdTemplate, error: createTemplateError } = await supabase
        .from('newsletters')
        .insert({
          week_number: null,
          title: metadata?.title?.trim() || sourceNewsletter.title || null,
          description: metadata?.description?.trim() || sourceNewsletter.description || null,
          release_date: metadata?.releaseDate || sourceNewsletter.release_date,
          status: 'draft',
          is_template: true,
          published_at: null,
        })
        .select()
        .single()

      if (createTemplateError || !createdTemplate) {
        throw new AdminServiceError(
          `Failed to create newsletter template: ${createTemplateError?.message || 'Unknown error'}`,
          'CREATE_NEWSLETTER_ERROR',
          createTemplateError as any
        )
      }

      const template = this.mapNewsletterRow(createdTemplate, 0)
      const copiedCount = await this.copyCompositionToNewsletter(sourceNewsletterId, template)

      return {
        ...template,
        articleCount: copiedCount,
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error creating template from newsletter: ${err instanceof Error ? err.message : String(err)}`,
        'CREATE_NEWSLETTER_ERROR',
        err as any
      )
    }
  }

  async createNewsletterFromTemplate(
    sourceNewsletterId: string,
    overrides: {
      weekNumber?: string | null
      title?: string | null
      description?: string | null
      releaseDate: string
    }
  ): Promise<AdminNewsletter> {
    try {
      const supabase = getSupabaseClient()

      const { data: sourceNewsletter, error: sourceNewsletterError } = await supabase
        .from('newsletters')
        .select('*')
        .eq('id', sourceNewsletterId)
        .single()

      if (sourceNewsletterError || !sourceNewsletter) {
        throw new AdminServiceError(
          `Source newsletter not found: ${sourceNewsletterId}`,
          'NEWSLETTER_NOT_FOUND',
          sourceNewsletterError as any
        )
      }

      if (!sourceNewsletter.is_template) {
        throw new AdminServiceError(
          `Source newsletter is not a template: ${sourceNewsletterId}`,
          'NEWSLETTER_NOT_TEMPLATE'
        )
      }

      const newNewsletter = await this.createNewsletter(
        overrides.weekNumber ?? null,
        overrides.releaseDate,
        {
          title: overrides.title ?? sourceNewsletter.title,
          description: overrides.description ?? sourceNewsletter.description,
        }
      )
      const copiedCount = await this.copyCompositionToNewsletter(sourceNewsletterId, newNewsletter)

      return {
        ...newNewsletter,
        articleCount: copiedCount,
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error creating newsletter from template: ${err instanceof Error ? err.message : String(err)}`,
        'CREATE_NEWSLETTER_FROM_TEMPLATE_ERROR',
        err as any
      )
    }
  }

  /**
   * Publish newsletter (draft → published)
   */
  async publishNewsletter(id: string): Promise<AdminNewsletter> {
    try {
      const supabase = getSupabaseClient()

      // Check that newsletter has at least one article via junction table
      const { data: articles, error: articleError } = await supabase
        .from('newsletter_articles')
        .select('article_id')
        .eq('newsletter_id', id)
        .limit(1)

      if (articleError) {
        throw new AdminServiceError(
          `Failed to check articles: ${articleError.message}`,
          'CHECK_ARTICLES_ERROR',
          articleError as any
        )
      }

      if (!articles || articles.length === 0) {
        throw new AdminServiceError(
          'Cannot publish newsletter without articles',
          'NO_ARTICLES_ERROR'
        )
      }

      // Update status to published
      const { data, error } = await supabase
        .from('newsletters')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        throw new AdminServiceError(
          `Failed to publish newsletter: ${error.message}`,
          'PUBLISH_NEWSLETTER_ERROR',
          error as any
        )
      }

      return {
        id: data.id,
        weekNumber: data.week_number,
        title: data.title,
        description: data.description,
        releaseDate: data.release_date,
        status: data.status,
        isTemplate: data.is_template ?? false,
        articleCount: 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        publishedAt: data.published_at,
        isPublished: data.status === 'published',
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error publishing newsletter: ${err instanceof Error ? err.message : String(err)}`,
        'PUBLISH_NEWSLETTER_ERROR',
        err as any
      )
    }
  }

  /**
   * Archive newsletter (any status → archived)
   */
  async archiveNewsletter(id: string): Promise<AdminNewsletter> {
    try {
      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .from('newsletters')
        .update({ status: 'archived' })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        throw new AdminServiceError(
          `Failed to archive newsletter: ${error.message}`,
          'ARCHIVE_NEWSLETTER_ERROR',
          error as any
        )
      }

      return {
        id: data.id,
        weekNumber: data.week_number,
        title: data.title,
        description: data.description,
        releaseDate: data.release_date,
        status: data.status,
        isTemplate: data.is_template ?? false,
        articleCount: 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        publishedAt: data.published_at,
        isPublished: data.status === 'published',
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error archiving newsletter: ${err instanceof Error ? err.message : String(err)}`,
        'ARCHIVE_NEWSLETTER_ERROR',
        err as any
      )
    }
  }

  /**
   * Delete newsletter
   */
  async deleteNewsletter(id: string): Promise<void> {
    try {
      const supabase = getSupabaseClient()

      const { error } = await supabase
        .from('newsletters')
        .delete()
        .eq('id', id)

      if (error) {
        throw new AdminServiceError(
          `Failed to delete newsletter: ${error.message}`,
          'DELETE_NEWSLETTER_ERROR',
          error as any
        )
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error deleting newsletter: ${err instanceof Error ? err.message : String(err)}`,
        'DELETE_NEWSLETTER_ERROR',
        err as any
      )
    }
  }

  /**
   * ============ ARTICLE OPERATIONS ============
   */

  /**
   * Fetch articles by newsletter (via junction table)
   */
  async fetchArticlesByNewsletter(
    weekNumber: string
  ): Promise<AdminArticle[]> {
    try {
      const supabase = getSupabaseClient()

      // Look up newsletter UUID by week_number
      const newsletterId = await this.getNewsletterIdByWeek(weekNumber)
      if (!newsletterId) {
        return []
      }

      const { data, error } = await supabase
        .from('newsletter_articles')
        .select(`
          article_order,
          targeting_mode,
          target_class_ids,
          articles!inner (*)
        `)
        .eq('newsletter_id', newsletterId)
        .order('article_order', { ascending: true })

      if (error) {
        throw new AdminServiceError(
          `Failed to fetch articles: ${error.message}`,
          'FETCH_ARTICLES_ERROR',
          error as any
        )
      }

      return (data || []).map((row: any) => ({
        id: row.articles.id,
        title: row.articles.title,
        content: row.articles.content,
        author: row.articles.author_id,
        summary: row.articles.summary,
        weekNumber: weekNumber,
        order: row.article_order,
        newsletterTargetingMode: row.targeting_mode ?? 'shared',
        newsletterTargetClassIds: row.target_class_ids ?? [],
        classIds: row.articles.class_ids || [],
        familyIds: row.articles.family_ids || [],
        status: row.articles.status,
        createdAt: row.articles.created_at,
        updatedAt: row.articles.updated_at,
        lastEditedBy: row.articles.last_edited_by,
        editedAt: row.articles.edited_at,
      }))
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching articles: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_ARTICLES_ERROR',
        err as any
      )
    }
  }

  /**
   * Fetch articles by newsletter ID (supports newsletters without week_number)
   */
  async fetchArticlesByNewsletterId(
    newsletterId: string
  ): Promise<AdminArticle[]> {
    try {
      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .from('newsletter_articles')
        .select(`
          article_order,
          targeting_mode,
          target_class_ids,
          articles!inner (*)
        `)
        .eq('newsletter_id', newsletterId)
        .order('article_order', { ascending: true })

      if (error) {
        throw new AdminServiceError(
          `Failed to fetch articles: ${error.message}`,
          'FETCH_ARTICLES_ERROR',
          error as any
        )
      }

      // Fetch newsletter to get week_number (may be null)
      const newsletterData = await this.fetchNewsletter(newsletterId)

      return (data || []).map((row: any) => ({
        id: row.articles.id,
        title: row.articles.title,
        content: row.articles.content,
        author: row.articles.author_id,
        summary: row.articles.summary,
        weekNumber: newsletterData.weekNumber || '',
        order: row.article_order,
        newsletterTargetingMode: row.targeting_mode ?? 'shared',
        newsletterTargetClassIds: row.target_class_ids ?? [],
        classIds: row.articles.class_ids || [],
        familyIds: row.articles.family_ids || [],
        status: row.articles.status,
        createdAt: row.articles.created_at,
        updatedAt: row.articles.updated_at,
        publishedAt: row.articles.published_at,
        editedAt: row.articles.edited_at,
      }))
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching articles: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_ARTICLES_ERROR',
        err as any
      )
    }
  }

  async fetchAllArticles(limit: number = 200): Promise<AdminArticle[]> {
    try {
      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(limit)

      if (error) {
        throw new AdminServiceError(
          `Failed to fetch all articles: ${error.message}`,
          'FETCH_ARTICLES_ERROR',
          error as any
        )
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        author: row.author_id,
        summary: row.summary,
        weekNumber: row.week_number || '',
        order: row.article_order || 0,
        classIds: row.class_ids || [],
        familyIds: row.family_ids || [],
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        publishedAt: row.published_at,
        editedAt: row.edited_at,
      }))
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching all articles: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_ARTICLES_ERROR',
        err as any
      )
    }
  }

  async fetchDeletedArticles(limit: number = 100): Promise<AdminRecycleBinArticle[]> {
    try {
      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .limit(limit)

      if (error) {
        throw new AdminServiceError(
          `Failed to fetch recycle bin articles: ${error.message}`,
          'FETCH_RECYCLE_BIN_ARTICLES_ERROR',
          error as any
        )
      }

      const deletedRows = (data || []).filter((row: any) => Boolean(row.deleted_at))
      const membershipsByArticleId = await this.fetchArticleNewsletterMemberships(
        deletedRows.map((row: any) => row.id)
      )

      return deletedRows.map((row: any) => {
        const deletedAt = row.deleted_at as string
        const memberships = membershipsByArticleId[row.id] || []
        const purgeScheduledAt = (row.purge_scheduled_at as string | null)
          || this.computeArticlePurgeScheduledAt(deletedAt)

        return {
          ...this.mapAdminArticleRow(row),
          deletedAt,
          deletedBy: row.deleted_by ?? null,
          purgeScheduledAt,
          retentionDays: ARTICLE_RECYCLE_BIN_RETENTION_DAYS,
          canPurge: memberships.length === 0,
          referenceCount: memberships.length,
          memberships,
        }
      })
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching recycle bin articles: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_RECYCLE_BIN_ARTICLES_ERROR',
        err as any
      )
    }
  }

  async fetchArticleVersionHistory(
    articleId: string,
    limit: number = 20,
  ): Promise<ArticleRevision[]> {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('article_audit_log')
        .select('id, article_id, action, changed_by, old_values, new_values, changed_at')
        .eq('article_id', articleId)
        .order('changed_at', { ascending: false })
        .limit(limit)

      if (error) {
        throw new AdminServiceError(
          `Failed to fetch article version history: ${error.message}`,
          'FETCH_ARTICLE_VERSION_HISTORY_ERROR',
          error as any,
        )
      }

      return (data || []).map((row: any) => {
        const oldValues = (row.old_values || null) as Record<string, unknown> | null
        const newValues = (row.new_values || null) as Record<string, unknown> | null
        const fieldDiffs = this.buildRevisionDiffs(oldValues, newValues)
        const actionLabel = this.getRevisionActionLabel(row.action)
        const changeSummary = fieldDiffs.length > 0
          ? `${actionLabel}（${fieldDiffs.length} 項欄位變更）`
          : actionLabel

        return {
          id: row.id,
          articleId: row.article_id,
          action: row.action,
          changedBy: row.changed_by,
          changedAt: row.changed_at,
          canRestore: Boolean(oldValues || newValues),
          changeSummary,
          fieldDiffs,
        } as ArticleRevision
      })
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching article version history: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_ARTICLE_VERSION_HISTORY_ERROR',
        err as any,
      )
    }
  }

  async restoreArticleVersion(
    articleId: string,
    revisionId: string,
  ): Promise<AdminArticle> {
    try {
      const supabase = getSupabaseClient()
      const { data: auditEntry, error: auditError } = await supabase
        .from('article_audit_log')
        .select('id, article_id, action, old_values, new_values')
        .eq('id', revisionId)
        .eq('article_id', articleId)
        .single()

      if (auditError || !auditEntry) {
        throw new AdminServiceError(
          `Article revision not found: ${revisionId}`,
          'ARTICLE_REVISION_NOT_FOUND',
          auditError as any,
        )
      }

      const snapshot = (auditEntry.new_values || auditEntry.old_values || null) as Record<string, unknown> | null
      if (!snapshot) {
        throw new AdminServiceError(
          'Selected revision has no snapshot data to restore',
          'ARTICLE_REVISION_RESTORE_ERROR',
        )
      }

      if (snapshot.id && snapshot.id !== articleId) {
        throw new AdminServiceError(
          'Revision snapshot does not match requested article',
          'ARTICLE_REVISION_RESTORE_ERROR',
        )
      }

      const updatePayload: Record<string, unknown> = {}
      const assignIfPresent = (column: string, snapshotKey: string = column) => {
        if (Object.prototype.hasOwnProperty.call(snapshot, snapshotKey)) {
          updatePayload[column] = snapshot[snapshotKey]
        }
      }

      assignIfPresent('title')
      assignIfPresent('content')
      assignIfPresent('summary')
      assignIfPresent('status')
      assignIfPresent('visibility_type')
      assignIfPresent('restricted_to_classes')
      assignIfPresent('author_id')
      assignIfPresent('deleted_at')

      if (
        updatePayload.visibility_type === 'class_restricted' &&
        (!Array.isArray(updatePayload.restricted_to_classes) || updatePayload.restricted_to_classes.length === 0)
      ) {
        throw new AdminServiceError(
          'Class-restricted revisions must include at least one target class',
          'ARTICLE_REVISION_RESTORE_ERROR',
        )
      }

      if (Object.keys(updatePayload).length === 0) {
        throw new AdminServiceError(
          'Selected revision has no restorable fields',
          'ARTICLE_REVISION_RESTORE_ERROR',
        )
      }

      const { data: restoredRow, error: restoreError } = await supabase
        .from('articles')
        .update(updatePayload)
        .eq('id', articleId)
        .select('*')
        .single()

      if (restoreError || !restoredRow) {
        throw new AdminServiceError(
          `Failed to restore article version: ${restoreError?.message || 'Unknown error'}`,
          'ARTICLE_REVISION_RESTORE_ERROR',
          restoreError as any,
        )
      }

      return this.mapAdminArticleRow(restoredRow)
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error restoring article version: ${err instanceof Error ? err.message : String(err)}`,
        'ARTICLE_REVISION_RESTORE_ERROR',
        err as any,
      )
    }
  }

  /**
   * Update article with Last-Write-Wins conflict resolution
   */
  async updateArticle(
    id: string,
    updates: Partial<AdminArticle>,
    currentEditedAt: string,
    userId: string
  ): Promise<AdminArticle> {
    try {
      const supabase = getSupabaseClient()

      // Check for concurrent edits using LWW
      const { data: existing, error: fetchError } = await supabase
        .from('articles')
        .select('edited_at, created_at')
        .eq('id', id)
        .single()

      if (fetchError) {
        throw new AdminServiceError(
          `Article not found: ${id}`,
          'ARTICLE_NOT_FOUND',
          fetchError as any
        )
      }

      // LWW: If server version is newer, update anyway (last write wins)
      const serverEditedAt = (existing?.edited_at as string) || (existing?.created_at as string)
      if (
        serverEditedAt &&
        new Date(serverEditedAt) > new Date(currentEditedAt)
      ) {
        console.warn(
          `Last-Write-Wins: Updating article ${id} despite newer server version`
        )
        // Continue with update - this is the LWW strategy
      }

      const now = new Date().toISOString()
      const updatePayload: any = {
        last_edited_by: userId,
        edited_at: now,
        updated_at: now,
      }

      // Map AdminArticle fields to database fields
      if (updates.title !== undefined) {
        updatePayload.title = updates.title
      }
      if (updates.content !== undefined) {
        updatePayload.content = updates.content
      }
      if (updates.author !== undefined) {
        updatePayload.author = updates.author
      }
      if (updates.summary !== undefined) {
        updatePayload.summary = updates.summary
      }
      if (updates.status !== undefined) {
        updatePayload.status = updates.status
      }
      if (updates.classIds !== undefined) {
        updatePayload.class_ids = updates.classIds
      }
      if (updates.familyIds !== undefined) {
        updatePayload.family_ids = updates.familyIds
      }

      const { data, error } = await supabase
        .from('articles')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        throw new AdminServiceError(
          `Failed to update article: ${error.message}`,
          'UPDATE_ARTICLE_ERROR',
          error as any
        )
      }

      return {
        id: data.id,
        title: data.title,
        content: data.content,
        author: data.author,
        summary: data.summary,
        weekNumber: data.week_number,
        order: data.article_order,
        classIds: data.class_ids || [],
        familyIds: data.family_ids || [],
        status: data.status,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        lastEditedBy: data.last_edited_by,
        editedAt: data.edited_at,
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error updating article: ${err instanceof Error ? err.message : String(err)}`,
        'UPDATE_ARTICLE_ERROR',
        err as any
      )
    }
  }

  /**
   * Delete article
   */
  async deleteArticle(id: string): Promise<void> {
    try {
      const supabase = getSupabaseClient()
      const { data: existing, error: existingError } = await supabase
        .from('articles')
        .select('id, deleted_at')
        .eq('id', id)
        .single()

      if (existingError || !existing) {
        throw new AdminServiceError(
          `Article not found: ${id}`,
          'ARTICLE_NOT_FOUND',
          existingError as any
        )
      }

      if (existing.deleted_at) {
        return
      }

      const actorId = await this.getCurrentAuthUserId()
      const deletedAt = new Date().toISOString()

      const { error } = await supabase
        .from('articles')
        .update({
          deleted_at: deletedAt,
          deleted_by: actorId,
          purge_scheduled_at: this.computeArticlePurgeScheduledAt(deletedAt),
          status: 'draft',
        })
        .eq('id', id)

      if (error) {
        throw new AdminServiceError(
          `Failed to delete article: ${error.message}`,
          'DELETE_ARTICLE_ERROR',
          error as any
        )
      }

      await articleMediaManager.deactivateArticleMediaUsage(id)
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error deleting article: ${err instanceof Error ? err.message : String(err)}`,
        'DELETE_ARTICLE_ERROR',
        err as any
      )
    }
  }

  async restoreDeletedArticle(id: string): Promise<AdminArticle> {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('articles')
        .update({
          deleted_at: null,
          deleted_by: null,
          purge_scheduled_at: null,
        })
        .eq('id', id)
        .select('*')
        .single()

      if (error || !data) {
        throw new AdminServiceError(
          `Failed to restore deleted article: ${error?.message || 'Unknown error'}`,
          'RESTORE_DELETED_ARTICLE_ERROR',
          error as any
        )
      }

      return this.mapAdminArticleRow(data)
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error restoring deleted article: ${err instanceof Error ? err.message : String(err)}`,
        'RESTORE_DELETED_ARTICLE_ERROR',
        err as any
      )
    }
  }

  async purgeDeletedArticle(id: string): Promise<void> {
    try {
      const supabase = getSupabaseClient()
      const { data: existing, error: existingError } = await supabase
        .from('articles')
        .select('id, title, deleted_at')
        .eq('id', id)
        .single()

      if (existingError || !existing) {
        throw new AdminServiceError(
          `Article not found: ${id}`,
          'ARTICLE_NOT_FOUND',
          existingError as any
        )
      }

      if (!existing.deleted_at) {
        throw new AdminServiceError(
          'Article must be moved to recycle bin before permanent purge',
          'PURGE_ARTICLE_GUARD_ERROR'
        )
      }

      const membershipsByArticleId = await this.fetchArticleNewsletterMemberships([id])
      const memberships = membershipsByArticleId[id] || []
      if (memberships.length > 0) {
        const labels = memberships.map((item) => item.label).join(', ')
        throw new AdminServiceError(
          `Cannot permanently delete article while referenced by newsletters: ${labels}`,
          'PURGE_ARTICLE_GUARD_ERROR'
        )
      }

      const { error: purgeError } = await supabase
        .from('articles')
        .delete()
        .eq('id', id)

      if (purgeError) {
        throw new AdminServiceError(
          `Failed to permanently delete article: ${purgeError.message}`,
          'PURGE_ARTICLE_ERROR',
          purgeError as any
        )
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error purging deleted article: ${err instanceof Error ? err.message : String(err)}`,
        'PURGE_ARTICLE_ERROR',
        err as any
      )
    }
  }

  /**
   * ============ NEWSLETTER-ARTICLE OPERATIONS ============
   * Many-to-many relationship management via junction table
   */

  /**
   * Add an existing article to a newsletter
   * @param articleId Article UUID
   * @param weekNumber Newsletter week number (e.g., "2025-W48")
   * @param order Optional article order in the newsletter
   * @param userId Optional user ID who is adding the article
   */
  async addArticleToNewsletter(
    articleId: string,
    weekNumber: string,
    order?: number,
    userId?: string,
    targeting?: {
      mode?: 'shared' | 'targeted'
      classIds?: string[]
    }
  ): Promise<{ id: string; newsletter_id: string; article_id: string; article_order: number }> {
    try {
      const supabase = getSupabaseClient()

      // Look up newsletter UUID by week_number
      const newsletterId = await this.getNewsletterIdByWeek(weekNumber)
      if (!newsletterId) {
        throw new AdminServiceError(
          `Newsletter not found for week ${weekNumber}`,
          'NEWSLETTER_NOT_FOUND'
        )
      }

      // Calculate next order if not provided
      let articleOrder = order
      if (articleOrder === undefined) {
        const { data: existing, error: orderError } = await supabase
          .from('newsletter_articles')
          .select('article_order')
          .eq('newsletter_id', newsletterId)
          .order('article_order', { ascending: false })
          .limit(1)

        if (orderError) {
          console.error('Error getting article order:', orderError)
        }
        articleOrder = (existing?.[0]?.article_order || 0) + 1
      }
      const normalized = this.normalizeTargeting(
        targeting?.mode ?? 'shared',
        targeting?.classIds ?? []
      )
      if (normalized.targetingMode === 'targeted' && normalized.targetClassIds.length === 0) {
        throw new AdminServiceError(
          '請至少選擇一個班級，或切換為共享文章',
          'VALIDATION_ERROR'
        )
      }
      await this.validateTargetClassIds(normalized.targetClassIds)

      const { data, error } = await supabase
        .from('newsletter_articles')
        .insert({
          newsletter_id: newsletterId,
          article_id: articleId,
          article_order: articleOrder,
          added_by: userId || null,
          targeting_mode: normalized.targetingMode,
          target_class_ids: normalized.targetClassIds,
        })
        .select()
        .single()

      if (error) {
        // Check for duplicate
        if (error.code === '23505') {
          throw new AdminServiceError(
            `Article is already in newsletter ${weekNumber}`,
            'DUPLICATE_ARTICLE_ERROR',
            error as any
          )
        }
        throw new AdminServiceError(
          `Failed to add article to newsletter: ${error.message}`,
          'ADD_ARTICLE_TO_NEWSLETTER_ERROR',
          error as any
        )
      }

      return data
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error adding article to newsletter: ${err instanceof Error ? err.message : String(err)}`,
        'ADD_ARTICLE_TO_NEWSLETTER_ERROR',
        err as any
      )
    }
  }

  async addArticleToNewsletterById(
    articleId: string,
    newsletterId: string,
    order?: number,
    userId?: string,
    targeting?: {
      mode?: 'shared' | 'targeted'
      classIds?: string[]
    }
  ): Promise<{ id: string; newsletter_id: string; article_id: string; article_order: number }> {
    try {
      const supabase = getSupabaseClient()

      let articleOrder = order
      if (articleOrder === undefined) {
        const { data: existing, error: orderError } = await supabase
          .from('newsletter_articles')
          .select('article_order')
          .eq('newsletter_id', newsletterId)
          .order('article_order', { ascending: false })
          .limit(1)

        if (orderError) {
          console.error('Error getting article order:', orderError)
        }

        articleOrder = (existing?.[0]?.article_order || 0) + 1
      }
      const normalized = this.normalizeTargeting(
        targeting?.mode ?? 'shared',
        targeting?.classIds ?? []
      )
      if (normalized.targetingMode === 'targeted' && normalized.targetClassIds.length === 0) {
        throw new AdminServiceError(
          '請至少選擇一個班級，或切換為共享文章',
          'VALIDATION_ERROR'
        )
      }
      await this.validateTargetClassIds(normalized.targetClassIds)

      const { data, error } = await supabase
        .from('newsletter_articles')
        .insert({
          newsletter_id: newsletterId,
          article_id: articleId,
          article_order: articleOrder,
          added_by: userId || null,
          targeting_mode: normalized.targetingMode,
          target_class_ids: normalized.targetClassIds,
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new AdminServiceError(
            `Article is already in newsletter ${newsletterId}`,
            'DUPLICATE_ARTICLE_ERROR',
            error as any
          )
        }

        throw new AdminServiceError(
          `Failed to add article to newsletter: ${error.message}`,
          'ADD_ARTICLE_TO_NEWSLETTER_ERROR',
          error as any
        )
      }

      return data
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error adding article to newsletter: ${err instanceof Error ? err.message : String(err)}`,
        'ADD_ARTICLE_TO_NEWSLETTER_ERROR',
        err as any
      )
    }
  }

  /**
   * Remove an article from a newsletter
   * @param articleId Article UUID
   * @param weekNumber Newsletter week number
   */
  async removeArticleFromNewsletter(articleId: string, weekNumber: string): Promise<void> {
    try {
      const supabase = getSupabaseClient()

      // Look up newsletter UUID by week_number
      const newsletterId = await this.getNewsletterIdByWeek(weekNumber)
      if (!newsletterId) {
        throw new AdminServiceError(
          `Newsletter not found for week ${weekNumber}`,
          'NEWSLETTER_NOT_FOUND'
        )
      }

      const { error } = await supabase
        .from('newsletter_articles')
        .delete()
        .eq('newsletter_id', newsletterId)
        .eq('article_id', articleId)

      if (error) {
        throw new AdminServiceError(
          `Failed to remove article from newsletter: ${error.message}`,
          'REMOVE_ARTICLE_FROM_NEWSLETTER_ERROR',
          error as any
        )
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error removing article from newsletter: ${err instanceof Error ? err.message : String(err)}`,
        'REMOVE_ARTICLE_FROM_NEWSLETTER_ERROR',
        err as any
      )
    }
  }

  async removeArticleFromNewsletterById(articleId: string, newsletterId: string): Promise<void> {
    try {
      const supabase = getSupabaseClient()

      const { error } = await supabase
        .from('newsletter_articles')
        .delete()
        .eq('newsletter_id', newsletterId)
        .eq('article_id', articleId)

      if (error) {
        throw new AdminServiceError(
          `Failed to remove article from newsletter: ${error.message}`,
          'REMOVE_ARTICLE_FROM_NEWSLETTER_ERROR',
          error as any
        )
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error removing article from newsletter: ${err instanceof Error ? err.message : String(err)}`,
        'REMOVE_ARTICLE_FROM_NEWSLETTER_ERROR',
        err as any
      )
    }
  }

  async updateArticleTargetingInNewsletterById(
    newsletterId: string,
    articleId: string,
    targetingMode: 'shared' | 'targeted',
    targetClassIds: string[] = []
  ): Promise<void> {
    try {
      const supabase = getSupabaseClient()
      const normalized = this.normalizeTargeting(targetingMode, targetClassIds)
      if (normalized.targetingMode === 'targeted' && normalized.targetClassIds.length === 0) {
        throw new AdminServiceError(
          '請至少選擇一個班級，或切換為共享文章',
          'VALIDATION_ERROR'
        )
      }
      await this.validateTargetClassIds(normalized.targetClassIds)

      const { error } = await supabase
        .from('newsletter_articles')
        .update({
          targeting_mode: normalized.targetingMode,
          target_class_ids: normalized.targetClassIds,
        })
        .eq('newsletter_id', newsletterId)
        .eq('article_id', articleId)

      if (error) {
        throw new AdminServiceError(
          `Failed to update article targeting: ${error.message}`,
          'UPDATE_ARTICLE_TARGETING_ERROR',
          error as any
        )
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error updating article targeting: ${err instanceof Error ? err.message : String(err)}`,
        'UPDATE_ARTICLE_TARGETING_ERROR',
        err as any
      )
    }
  }

  /**
   * Get all newsletters that contain a specific article
   * @param articleId Article UUID
   */
  async getNewslettersForArticle(
    articleId: string
  ): Promise<Array<{ weekNumber: string; order: number; releaseDate?: string; status?: string }>> {
    try {
      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .from('newsletter_articles')
        .select(`
          newsletter_id,
          article_order,
          newsletters!inner (
            week_number,
            release_date,
            status
          )
        `)
        .eq('article_id', articleId)
        .order('article_order', { ascending: true })

      if (error) {
        throw new AdminServiceError(
          `Failed to get newsletters for article: ${error.message}`,
          'GET_NEWSLETTERS_ERROR',
          error as any
        )
      }

      return (data || []).map((row: any) => ({
        weekNumber: row.newsletters?.week_number || '',
        order: row.article_order,
        releaseDate: row.newsletters?.release_date,
        status: row.newsletters?.status,
      }))
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error getting newsletters for article: ${err instanceof Error ? err.message : String(err)}`,
        'GET_NEWSLETTERS_ERROR',
        err as any
      )
    }
  }

  async fetchArticleNewsletterMemberships(
    articleIds: string[]
  ): Promise<Record<string, Array<{ newsletterId: string; label: string; isTemplate: boolean }>>> {
    if (!articleIds.length) return {}

    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('newsletter_articles')
        .select(`
          article_id,
          newsletters!inner (
            id,
            week_number,
            title,
            is_template
          )
        `)
        .in('article_id', articleIds)

      if (error) {
        throw new AdminServiceError(
          `Failed to fetch article newsletter memberships: ${error.message}`,
          'GET_NEWSLETTERS_ERROR',
          error as any
        )
      }

      return (data || []).reduce((acc: Record<string, Array<{ newsletterId: string; label: string; isTemplate: boolean }>>, row: any) => {
        const articleId = row.article_id as string
        const newsletterId = row.newsletters?.id as string | undefined
        if (!newsletterId) return acc

        if (!acc[articleId]) {
          acc[articleId] = []
        }

        acc[articleId].push({
          newsletterId,
          label: row.newsletters?.week_number || row.newsletters?.title || newsletterId,
          isTemplate: row.newsletters?.is_template ?? false,
        })

        return acc
      }, {})
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching article newsletter memberships: ${err instanceof Error ? err.message : String(err)}`,
        'GET_NEWSLETTERS_ERROR',
        err as any
      )
    }
  }

  async fetchArticleCategories(
    options: FetchArticleTaxonomyOptions = {}
  ): Promise<ArticleCategory[]> {
    try {
      const supabase = getSupabaseClient()
      let query = supabase
        .from('article_categories')
        .select('*')
        .order('name', { ascending: true })

      if (!options.includeInactive) {
        query = query.eq('is_active', true)
      }

      const { data, error } = await query
      if (error) {
        throw new AdminServiceError(
          `Failed to fetch article categories: ${error.message}`,
          'FETCH_ARTICLE_CATEGORIES_ERROR',
          error as any
        )
      }

      return (data || []).map((row: any) => this.mapArticleCategoryRow(row))
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching article categories: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_ARTICLE_CATEGORIES_ERROR',
        err as any
      )
    }
  }

  async createArticleCategory(
    name: string,
    description?: string
  ): Promise<ArticleCategory> {
    const normalizedName = name.trim()
    if (!normalizedName) {
      throw new AdminServiceError('分類名稱為必填項', 'ARTICLE_CATEGORY_VALIDATION_ERROR')
    }

    try {
      const supabase = getSupabaseClient()
      const { data: duplicates, error: duplicateError } = await supabase
        .from('article_categories')
        .select('id')
        .ilike('name', normalizedName)
        .eq('is_active', true)

      if (duplicateError) {
        throw new AdminServiceError(
          `Failed to validate category uniqueness: ${duplicateError.message}`,
          'ARTICLE_CATEGORY_VALIDATION_ERROR',
          duplicateError as any
        )
      }

      if ((duplicates || []).length > 0) {
        throw new AdminServiceError('分類名稱已存在', 'ARTICLE_CATEGORY_VALIDATION_ERROR')
      }

      const { data, error } = await supabase
        .from('article_categories')
        .insert({
          name: normalizedName,
          description: description?.trim() || null,
          is_active: true,
        })
        .select('*')
        .single()

      if (error) {
        throw new AdminServiceError(
          `Failed to create category: ${error.message}`,
          'CREATE_ARTICLE_CATEGORY_ERROR',
          error as any
        )
      }

      return this.mapArticleCategoryRow(data)
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error creating category: ${err instanceof Error ? err.message : String(err)}`,
        'CREATE_ARTICLE_CATEGORY_ERROR',
        err as any
      )
    }
  }

  async updateArticleCategory(
    id: string,
    updates: { name?: string; description?: string }
  ): Promise<ArticleCategory> {
    try {
      const supabase = getSupabaseClient()
      const { data: existing, error: existingError } = await supabase
        .from('article_categories')
        .select('*')
        .eq('id', id)
        .single()

      if (existingError || !existing) {
        throw new AdminServiceError(
          `Failed to load category: ${existingError?.message || 'Category not found'}`,
          'UPDATE_ARTICLE_CATEGORY_ERROR',
          existingError as any
        )
      }

      const updatePayload: Record<string, unknown> = {}
      if (updates.name !== undefined) {
        const normalizedName = updates.name.trim()
        if (!normalizedName) {
          throw new AdminServiceError('分類名稱為必填項', 'ARTICLE_CATEGORY_VALIDATION_ERROR')
        }

        const { data: duplicates, error: duplicateError } = await supabase
          .from('article_categories')
          .select('id')
          .ilike('name', normalizedName)
          .eq('is_active', true)

        if (duplicateError) {
          throw new AdminServiceError(
            `Failed to validate category uniqueness: ${duplicateError.message}`,
            'ARTICLE_CATEGORY_VALIDATION_ERROR',
            duplicateError as any
          )
        }

        const duplicate = (duplicates || []).find((row: any) => row.id !== id)
        if (duplicate) {
          throw new AdminServiceError('分類名稱已存在', 'ARTICLE_CATEGORY_VALIDATION_ERROR')
        }

        updatePayload.name = normalizedName
      }

      if (updates.description !== undefined) {
        updatePayload.description = updates.description.trim() || null
      }

      const { data, error } = await supabase
        .from('article_categories')
        .update(updatePayload)
        .eq('id', id)
        .select('*')
        .single()

      if (error || !data) {
        throw new AdminServiceError(
          `Failed to update category: ${error?.message || 'Unknown error'}`,
          'UPDATE_ARTICLE_CATEGORY_ERROR',
          error as any
        )
      }

      return this.mapArticleCategoryRow(data)
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error updating category: ${err instanceof Error ? err.message : String(err)}`,
        'UPDATE_ARTICLE_CATEGORY_ERROR',
        err as any
      )
    }
  }

  async activateArticleCategory(id: string): Promise<ArticleCategory> {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('article_categories')
        .update({ is_active: true })
        .eq('id', id)
        .select('*')
        .single()

      if (error || !data) {
        throw new AdminServiceError(
          `Failed to activate category: ${error?.message || 'Unknown error'}`,
          'ACTIVATE_ARTICLE_CATEGORY_ERROR',
          error as any
        )
      }

      return this.mapArticleCategoryRow(data)
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error activating category: ${err instanceof Error ? err.message : String(err)}`,
        'ACTIVATE_ARTICLE_CATEGORY_ERROR',
        err as any
      )
    }
  }

  async deactivateArticleCategory(id: string): Promise<ArticleCategory> {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('article_categories')
        .update({ is_active: false })
        .eq('id', id)
        .select('*')
        .single()

      if (error || !data) {
        throw new AdminServiceError(
          `Failed to deactivate category: ${error?.message || 'Unknown error'}`,
          'DEACTIVATE_ARTICLE_CATEGORY_ERROR',
          error as any
        )
      }

      return this.mapArticleCategoryRow(data)
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error deactivating category: ${err instanceof Error ? err.message : String(err)}`,
        'DEACTIVATE_ARTICLE_CATEGORY_ERROR',
        err as any
      )
    }
  }

  async fetchArticleTags(
    options: FetchArticleTaxonomyOptions = {}
  ): Promise<ArticleTag[]> {
    try {
      const supabase = getSupabaseClient()
      let query = supabase
        .from('article_tags')
        .select('*')
        .order('name', { ascending: true })

      if (!options.includeInactive) {
        query = query.eq('is_active', true)
      }

      const { data, error } = await query
      if (error) {
        throw new AdminServiceError(
          `Failed to fetch article tags: ${error.message}`,
          'FETCH_ARTICLE_TAGS_ERROR',
          error as any
        )
      }

      return (data || []).map((row: any) => this.mapArticleTagRow(row))
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching article tags: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_ARTICLE_TAGS_ERROR',
        err as any
      )
    }
  }

  async createArticleTag(
    name: string,
    description?: string
  ): Promise<ArticleTag> {
    const normalizedName = name.trim()
    if (!normalizedName) {
      throw new AdminServiceError('標籤名稱為必填項', 'ARTICLE_TAG_VALIDATION_ERROR')
    }

    try {
      const supabase = getSupabaseClient()
      const { data: duplicates, error: duplicateError } = await supabase
        .from('article_tags')
        .select('id')
        .ilike('name', normalizedName)
        .eq('is_active', true)

      if (duplicateError) {
        throw new AdminServiceError(
          `Failed to validate tag uniqueness: ${duplicateError.message}`,
          'ARTICLE_TAG_VALIDATION_ERROR',
          duplicateError as any
        )
      }

      if ((duplicates || []).length > 0) {
        throw new AdminServiceError('標籤名稱已存在', 'ARTICLE_TAG_VALIDATION_ERROR')
      }

      const { data, error } = await supabase
        .from('article_tags')
        .insert({
          name: normalizedName,
          description: description?.trim() || null,
          is_active: true,
        })
        .select('*')
        .single()

      if (error) {
        throw new AdminServiceError(
          `Failed to create tag: ${error.message}`,
          'CREATE_ARTICLE_TAG_ERROR',
          error as any
        )
      }

      return this.mapArticleTagRow(data)
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error creating tag: ${err instanceof Error ? err.message : String(err)}`,
        'CREATE_ARTICLE_TAG_ERROR',
        err as any
      )
    }
  }

  async updateArticleTag(
    id: string,
    updates: { name?: string; description?: string }
  ): Promise<ArticleTag> {
    try {
      const supabase = getSupabaseClient()
      const { data: existing, error: existingError } = await supabase
        .from('article_tags')
        .select('*')
        .eq('id', id)
        .single()

      if (existingError || !existing) {
        throw new AdminServiceError(
          `Failed to load tag: ${existingError?.message || 'Tag not found'}`,
          'UPDATE_ARTICLE_TAG_ERROR',
          existingError as any
        )
      }

      const updatePayload: Record<string, unknown> = {}
      if (updates.name !== undefined) {
        const normalizedName = updates.name.trim()
        if (!normalizedName) {
          throw new AdminServiceError('標籤名稱為必填項', 'ARTICLE_TAG_VALIDATION_ERROR')
        }

        const { data: duplicates, error: duplicateError } = await supabase
          .from('article_tags')
          .select('id')
          .ilike('name', normalizedName)
          .eq('is_active', true)

        if (duplicateError) {
          throw new AdminServiceError(
            `Failed to validate tag uniqueness: ${duplicateError.message}`,
            'ARTICLE_TAG_VALIDATION_ERROR',
            duplicateError as any
          )
        }

        const duplicate = (duplicates || []).find((row: any) => row.id !== id)
        if (duplicate) {
          throw new AdminServiceError('標籤名稱已存在', 'ARTICLE_TAG_VALIDATION_ERROR')
        }

        updatePayload.name = normalizedName
      }

      if (updates.description !== undefined) {
        updatePayload.description = updates.description.trim() || null
      }

      const { data, error } = await supabase
        .from('article_tags')
        .update(updatePayload)
        .eq('id', id)
        .select('*')
        .single()

      if (error || !data) {
        throw new AdminServiceError(
          `Failed to update tag: ${error?.message || 'Unknown error'}`,
          'UPDATE_ARTICLE_TAG_ERROR',
          error as any
        )
      }

      return this.mapArticleTagRow(data)
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error updating tag: ${err instanceof Error ? err.message : String(err)}`,
        'UPDATE_ARTICLE_TAG_ERROR',
        err as any
      )
    }
  }

  async activateArticleTag(id: string): Promise<ArticleTag> {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('article_tags')
        .update({ is_active: true })
        .eq('id', id)
        .select('*')
        .single()

      if (error || !data) {
        throw new AdminServiceError(
          `Failed to activate tag: ${error?.message || 'Unknown error'}`,
          'ACTIVATE_ARTICLE_TAG_ERROR',
          error as any
        )
      }

      return this.mapArticleTagRow(data)
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error activating tag: ${err instanceof Error ? err.message : String(err)}`,
        'ACTIVATE_ARTICLE_TAG_ERROR',
        err as any
      )
    }
  }

  async deactivateArticleTag(id: string): Promise<ArticleTag> {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('article_tags')
        .update({ is_active: false })
        .eq('id', id)
        .select('*')
        .single()

      if (error || !data) {
        throw new AdminServiceError(
          `Failed to deactivate tag: ${error?.message || 'Unknown error'}`,
          'DEACTIVATE_ARTICLE_TAG_ERROR',
          error as any
        )
      }

      return this.mapArticleTagRow(data)
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error deactivating tag: ${err instanceof Error ? err.message : String(err)}`,
        'DEACTIVATE_ARTICLE_TAG_ERROR',
        err as any
      )
    }
  }

  async fetchArticleTaxonomyAssignments(
    articleIds: string[]
  ): Promise<Record<string, { categoryIds: string[]; tagIds: string[] }>> {
    if (!articleIds.length) return {}

    try {
      const supabase = getSupabaseClient()
      const [categoryRows, tagRows] = await Promise.all([
        supabase
          .from('article_category_assignments')
          .select('article_id, category_id')
          .in('article_id', articleIds),
        supabase
          .from('article_tag_assignments')
          .select('article_id, tag_id')
          .in('article_id', articleIds),
      ])

      if (categoryRows.error) {
        throw new AdminServiceError(
          `Failed to fetch category assignments: ${categoryRows.error.message}`,
          'FETCH_ARTICLE_TAXONOMY_ASSIGNMENTS_ERROR',
          categoryRows.error as any
        )
      }

      if (tagRows.error) {
        throw new AdminServiceError(
          `Failed to fetch tag assignments: ${tagRows.error.message}`,
          'FETCH_ARTICLE_TAXONOMY_ASSIGNMENTS_ERROR',
          tagRows.error as any
        )
      }

      const result: Record<string, { categoryIds: string[]; tagIds: string[] }> = {}
      articleIds.forEach((articleId) => {
        result[articleId] = { categoryIds: [], tagIds: [] }
      })

      ;(categoryRows.data || []).forEach((row: any) => {
        const articleId = row.article_id as string
        const categoryId = row.category_id as string
        if (!result[articleId]) {
          result[articleId] = { categoryIds: [], tagIds: [] }
        }
        if (!result[articleId].categoryIds.includes(categoryId)) {
          result[articleId].categoryIds.push(categoryId)
        }
      })

      ;(tagRows.data || []).forEach((row: any) => {
        const articleId = row.article_id as string
        const tagId = row.tag_id as string
        if (!result[articleId]) {
          result[articleId] = { categoryIds: [], tagIds: [] }
        }
        if (!result[articleId].tagIds.includes(tagId)) {
          result[articleId].tagIds.push(tagId)
        }
      })

      return result
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching taxonomy assignments: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_ARTICLE_TAXONOMY_ASSIGNMENTS_ERROR',
        err as any
      )
    }
  }

  async updateArticleTaxonomyAssignments(
    articleId: string,
    payload: { categoryIds: string[]; tagIds: string[] }
  ): Promise<void> {
    try {
      const supabase = getSupabaseClient()
      const categoryIds = [...new Set(payload.categoryIds)]
      const tagIds = [...new Set(payload.tagIds)]

      await this.validateTaxonomyIds('article_categories', categoryIds)
      await this.validateTaxonomyIds('article_tags', tagIds)

      const { error: deleteCategoryError } = await supabase
        .from('article_category_assignments')
        .delete()
        .eq('article_id', articleId)
      if (deleteCategoryError) {
        throw new AdminServiceError(
          `Failed to clear category assignments: ${deleteCategoryError.message}`,
          'UPDATE_ARTICLE_TAXONOMY_ASSIGNMENTS_ERROR',
          deleteCategoryError as any
        )
      }

      const { error: deleteTagError } = await supabase
        .from('article_tag_assignments')
        .delete()
        .eq('article_id', articleId)
      if (deleteTagError) {
        throw new AdminServiceError(
          `Failed to clear tag assignments: ${deleteTagError.message}`,
          'UPDATE_ARTICLE_TAXONOMY_ASSIGNMENTS_ERROR',
          deleteTagError as any
        )
      }

      if (categoryIds.length > 0) {
        const { error: insertCategoryError } = await supabase
          .from('article_category_assignments')
          .insert(
            categoryIds.map((categoryId) => ({
              article_id: articleId,
              category_id: categoryId,
            }))
          )
        if (insertCategoryError) {
          throw new AdminServiceError(
            `Failed to save category assignments: ${insertCategoryError.message}`,
            'UPDATE_ARTICLE_TAXONOMY_ASSIGNMENTS_ERROR',
            insertCategoryError as any
          )
        }
      }

      if (tagIds.length > 0) {
        const { error: insertTagError } = await supabase
          .from('article_tag_assignments')
          .insert(
            tagIds.map((tagId) => ({
              article_id: articleId,
              tag_id: tagId,
            }))
          )
        if (insertTagError) {
          throw new AdminServiceError(
            `Failed to save tag assignments: ${insertTagError.message}`,
            'UPDATE_ARTICLE_TAXONOMY_ASSIGNMENTS_ERROR',
            insertTagError as any
          )
        }
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error updating taxonomy assignments: ${err instanceof Error ? err.message : String(err)}`,
        'UPDATE_ARTICLE_TAXONOMY_ASSIGNMENTS_ERROR',
        err as any
      )
    }
  }

  /**
   * Get available articles that can be added to a newsletter
   * Returns articles not already in the specified newsletter
   * @param weekNumber Newsletter week number to exclude articles from
   * @param limit Maximum number of articles to return
   */
  async getAvailableArticles(
    weekNumber?: string,
    limit: number = 50
  ): Promise<AdminArticle[]> {
    try {
      const supabase = getSupabaseClient()

      // Get all articles
      let query = supabase
        .from('articles')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit)

      const { data, error } = await query

      if (error) {
        throw new AdminServiceError(
          `Failed to fetch available articles: ${error.message}`,
          'FETCH_ARTICLES_ERROR',
          error as any
        )
      }

      // If weekNumber is provided, filter out articles already in that newsletter
      let articles = data || []
      if (weekNumber) {
        const newsletterId = await this.getNewsletterIdByWeek(weekNumber)
        if (newsletterId) {
          const { data: existingArticles, error: existingError } = await supabase
            .from('newsletter_articles')
            .select('article_id')
            .eq('newsletter_id', newsletterId)

          if (existingError) {
            console.error('Error fetching existing articles:', existingError)
          } else {
            const existingIds = new Set((existingArticles || []).map((a: any) => a.article_id))
            articles = articles.filter((a: any) => !existingIds.has(a.id))
          }
        }
      }

      return articles.map((row: any) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        author: row.author,
        summary: row.summary,
        weekNumber: row.week_number,
        order: row.article_order,
        classIds: row.class_ids || [],
        familyIds: row.family_ids || [],
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastEditedBy: row.last_edited_by,
        editedAt: row.edited_at,
      }))
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching available articles: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_ARTICLES_ERROR',
        err as any
      )
    }
  }

  async getAvailableArticlesByNewsletterId(
    newsletterId?: string,
    limit: number = 50
  ): Promise<AdminArticle[]> {
    try {
      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        throw new AdminServiceError(
          `Failed to fetch available articles: ${error.message}`,
          'FETCH_ARTICLES_ERROR',
          error as any
        )
      }

      let articles = data || []

      if (newsletterId) {
        const { data: existingArticles, error: existingError } = await supabase
          .from('newsletter_articles')
          .select('article_id')
          .eq('newsletter_id', newsletterId)

        if (existingError) {
          console.error('Error fetching existing articles:', existingError)
        } else {
          const existingIds = new Set((existingArticles || []).map((a: any) => a.article_id))
          articles = articles.filter((article: any) => !existingIds.has(article.id))
        }
      }

      return articles.map((row: any) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        author: row.author,
        summary: row.summary,
        weekNumber: row.week_number,
        order: row.article_order,
        classIds: row.class_ids || [],
        familyIds: row.family_ids || [],
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastEditedBy: row.last_edited_by,
        editedAt: row.edited_at,
      }))
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching available articles: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_ARTICLES_ERROR',
        err as any
      )
    }
  }

  /**
   * Reorder articles within a newsletter
   * @param weekNumber Newsletter week number
   * @param articleIds Array of article IDs in desired order
   */
  async reorderArticlesInNewsletter(weekNumber: string, articleIds: string[]): Promise<void> {
    try {
      // Look up newsletter UUID by week_number
      const newsletterId = await this.getNewsletterIdByWeek(weekNumber)
      if (!newsletterId) {
        throw new AdminServiceError(
          `Newsletter not found for week ${weekNumber}`,
          'NEWSLETTER_NOT_FOUND'
        )
      }

      await this.reorderArticlesInNewsletterById(newsletterId, articleIds)
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error reordering articles: ${err instanceof Error ? err.message : String(err)}`,
        'REORDER_ARTICLES_ERROR',
        err as any
      )
    }
  }

  async reorderArticlesInNewsletterById(newsletterId: string, articleIds: string[]): Promise<void> {
    try {
      const supabase = getSupabaseClient()

      if (articleIds.length === 0) return

      const { data: existingOrders, error: fetchOrderError } = await supabase
        .from('newsletter_articles')
        .select('article_order')
        .eq('newsletter_id', newsletterId)
        .order('article_order', { ascending: false })
        .limit(1)

      if (fetchOrderError) {
        throw new AdminServiceError(
          `Failed to fetch current article order baseline: ${fetchOrderError.message}`,
          'REORDER_ARTICLES_ERROR',
          fetchOrderError as any
        )
      }

      const maxExistingOrder = existingOrders?.[0]?.article_order || 0
      const tempBaseOrder = maxExistingOrder + articleIds.length + 100

      // Phase 1: move to guaranteed-unique temporary positions to avoid
      // unique(newsletter_id, article_order) collisions during swaps.
      for (let i = 0; i < articleIds.length; i++) {
        const { error } = await supabase
          .from('newsletter_articles')
          .update({ article_order: tempBaseOrder + i + 1 })
          .eq('newsletter_id', newsletterId)
          .eq('article_id', articleIds[i])

        if (error) {
          throw new AdminServiceError(
            `Failed to stage article order update: ${error.message}`,
            'REORDER_ARTICLES_ERROR',
            error as any
          )
        }
      }

      // Phase 2: write final intended order.
      for (let i = 0; i < articleIds.length; i++) {
        const { error } = await supabase
          .from('newsletter_articles')
          .update({ article_order: i + 1 })
          .eq('newsletter_id', newsletterId)
          .eq('article_id', articleIds[i])

        if (error) {
          throw new AdminServiceError(
            `Failed to update article order: ${error.message}`,
            'REORDER_ARTICLES_ERROR',
            error as any
          )
        }
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error reordering articles: ${err instanceof Error ? err.message : String(err)}`,
        'REORDER_ARTICLES_ERROR',
        err as any
      )
    }
  }

  async createArticleForNewsletter(newsletterId: string): Promise<AdminArticle> {
    try {
      const supabase = getSupabaseClient()
      const newsletter = await this.fetchNewsletter(newsletterId)

      const { data: existing, error: orderError } = await supabase
        .from('newsletter_articles')
        .select('article_order')
        .eq('newsletter_id', newsletterId)
        .order('article_order', { ascending: false })
        .limit(1)

      if (orderError) {
        throw new AdminServiceError(
          `Failed to determine article order: ${orderError.message}`,
          'CREATE_ARTICLE_ERROR',
          orderError as any
        )
      }

      const nextOrder = (existing?.[0]?.article_order || 0) + 1
      const now = new Date().toISOString()

      const { data: article, error: articleError } = await supabase
        .from('articles')
        .insert({
          title: '未命名文章',
          content: '',
          status: 'draft',
          summary: null,
          week_number: newsletter.weekNumber || null,
          article_order: nextOrder,
          published_at: null,
          edited_at: now,
        })
        .select()
        .single()

      if (articleError || !article) {
        throw new AdminServiceError(
          `Failed to create article: ${articleError?.message || 'Unknown error'}`,
          'CREATE_ARTICLE_ERROR',
          articleError as any
        )
      }

      await this.addArticleToNewsletterById(article.id, newsletterId, nextOrder, undefined, {
        mode: 'shared',
        classIds: [],
      })

      return {
        id: article.id,
        title: article.title,
        content: article.content,
        author: article.author,
        summary: article.summary,
        weekNumber: newsletter.weekNumber || '',
        order: nextOrder,
        newsletterTargetingMode: 'shared',
        newsletterTargetClassIds: [],
        classIds: article.class_ids || [],
        familyIds: article.family_ids || [],
        status: article.status,
        createdAt: article.created_at,
        updatedAt: article.updated_at,
        lastEditedBy: article.last_edited_by,
        editedAt: article.edited_at,
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error creating article: ${err instanceof Error ? err.message : String(err)}`,
        'CREATE_ARTICLE_ERROR',
        err as any
      )
    }
  }

  /**
   * Fetch articles by newsletter using the junction table
   * This is the preferred method for the new many-to-many relationship
   */
  async fetchArticlesByNewsletterViaJunction(weekNumber: string): Promise<AdminArticle[]> {
    try {
      const supabase = getSupabaseClient()

      // Look up newsletter UUID by week_number
      const newsletterId = await this.getNewsletterIdByWeek(weekNumber)
      if (!newsletterId) {
        return []
      }

      const { data, error } = await supabase
        .from('newsletter_articles')
        .select(`
          article_order,
          targeting_mode,
          target_class_ids,
          articles!inner (*)
        `)
        .eq('newsletter_id', newsletterId)
        .order('article_order', { ascending: true })

      if (error) {
        throw new AdminServiceError(
          `Failed to fetch articles: ${error.message}`,
          'FETCH_ARTICLES_ERROR',
          error as any
        )
      }

      return (data || []).map((row: any) => ({
        id: row.articles.id,
        title: row.articles.title,
        content: row.articles.content,
        author: row.articles.author,
        summary: row.articles.summary,
        weekNumber: weekNumber,
        order: row.article_order,
        newsletterTargetingMode: row.targeting_mode ?? 'shared',
        newsletterTargetClassIds: row.target_class_ids ?? [],
        classIds: row.articles.class_ids || [],
        familyIds: row.articles.family_ids || [],
        status: row.articles.status,
        createdAt: row.articles.created_at,
        updatedAt: row.articles.updated_at,
        lastEditedBy: row.articles.last_edited_by,
        editedAt: row.articles.edited_at,
      }))
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching articles: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_ARTICLES_ERROR',
        err as any
      )
    }
  }

  /**
   * ============ CLASS OPERATIONS ============
   */

  /**
   * Fetch all classes
   */
  async fetchClasses(options: FetchClassesOptions = {}): Promise<Class[]> {
    try {
      const supabase = getSupabaseClient()

      let classQuery = supabase
        .from('classes')
        .select('*')
      if (!options.includeInactive) {
        classQuery = classQuery.eq('is_active', true)
      }
      const { data, error } = await classQuery
        .order('class_name', { ascending: true })

      if (error) {
        throw new AdminServiceError(
          `Failed to fetch classes: ${error.message}`,
          'FETCH_CLASSES_ERROR',
          error as any
        )
      }

      // Fetch student enrollments and teacher assignments for all classes
      const classIds = (data || []).map((row: any) => row.id)

      const { data: enrollments, error: enrollmentError } = await supabase
        .from('student_class_enrollment')
        .select('class_id, student_id')
        .in('class_id', classIds)

      if (enrollmentError) {
        // Log error but don't fail - classes can exist without students
        console.error('Failed to fetch class enrollments:', enrollmentError)
      }

      const { data: teacherAssignments, error: teacherError } = await supabase
        .from('teacher_class_assignment')
        .select('class_id, teacher_id')
        .in('class_id', classIds)

      if (teacherError) {
        // Log error but don't fail - classes can exist without teachers
        console.error('Failed to fetch teacher assignments:', teacherError)
      }

      // Build a map of class_id -> student_ids array
      const studentsByClass = new Map<string, string[]>()
      ;(enrollments || []).forEach((enrollment: any) => {
        if (!studentsByClass.has(enrollment.class_id)) {
          studentsByClass.set(enrollment.class_id, [])
        }
        studentsByClass.get(enrollment.class_id)!.push(enrollment.student_id)
      })

      // Build a map of class_id -> teacher_ids array
      const teachersByClass = new Map<string, string[]>()
      ;(teacherAssignments || []).forEach((assignment: any) => {
        if (!teachersByClass.has(assignment.class_id)) {
          teachersByClass.set(assignment.class_id, [])
        }
        teachersByClass.get(assignment.class_id)!.push(assignment.teacher_id)
      })

      return (data || []).map((row: any) => ({
        id: row.id,
        code: row.class_code || row.id,
        name: row.class_name,
        description: row.description || '',
        gradeYear: row.class_grade_year,
        isActive: row.is_active ?? true,
        deactivatedAt: row.deactivated_at ?? null,
        studentIds: studentsByClass.get(row.id) || [],
        teacherIds: teachersByClass.get(row.id) || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at || row.created_at,
      }))
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching classes: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_CLASSES_ERROR',
        err as any
      )
    }
  }

  /**
   * Create class
   */
  async createClass(
    name: string,
    description?: string,
    studentIds?: string[],
    teacherIds?: string[],
    options: ClassWriteOptions = {}
  ): Promise<Class> {
    try {
      const supabase = getSupabaseClient()
      const normalizedCode = this.normalizeClassCode(options.code || name)
      const gradeYear = options.gradeYear ?? 1
      await this.validateClassWriteInput({
        name,
        code: normalizedCode,
        gradeYear,
      })

      const { data, error } = await supabase
        .from('classes')
        .insert({
          id: normalizedCode,
          class_code: normalizedCode,
          class_name: name,
          class_grade_year: gradeYear,
          description: description || null,
          is_active: true,
        })
        .select()
        .single()

      if (error) {
        throw new AdminServiceError(
          `Failed to create class: ${error.message}`,
          'CREATE_CLASS_ERROR',
          error as any
        )
      }

      await this.writeClassAudit(
        data.id,
        'create',
        null,
        {
          id: data.id,
          class_code: data.class_code || normalizedCode,
          class_name: data.class_name,
          class_grade_year: data.class_grade_year,
          description: data.description || null,
          is_active: data.is_active ?? true,
        },
        options.actorId
      )

      // Add student enrollments if provided
      if (studentIds && studentIds.length > 0) {
        // Get family_id for each student from family_enrollment table
        const { data: familyEnrollments, error: familyError } = await supabase
          .from('family_enrollment')
          .select('student_id, family_id')
          .in('student_id', studentIds)

        if (familyError) {
          console.error('Failed to fetch family enrollments:', familyError)
        }

        // Create a map of student_id -> family_id
        const studentFamilyMap = new Map<string, string>()
        ;(familyEnrollments || []).forEach((enrollment: any) => {
          studentFamilyMap.set(enrollment.student_id, enrollment.family_id)
        })

        // Build enrollments with correct family_id
        const enrollmentsToAdd = studentIds.map((studentId: string) => ({
          class_id: data.id,
          student_id: studentId,
          family_id: studentFamilyMap.get(studentId) || '', // Use family from enrollment or empty if not found
        }))

        const { error: insertError } = await supabase
          .from('student_class_enrollment')
          .insert(enrollmentsToAdd)

        if (insertError) {
          console.error('Failed to add students to new class:', insertError)
        }
      }

      // Add teacher assignments if provided
      if (teacherIds && teacherIds.length > 0) {
        const assignmentsToAdd = teacherIds.map((teacherId: string) => ({
          class_id: data.id,
          teacher_id: teacherId,
        }))

        const { error: teacherError } = await supabase
          .from('teacher_class_assignment')
          .insert(assignmentsToAdd)

        if (teacherError) {
          throw new AdminServiceError(
            `Failed to add teachers to new class: ${teacherError.message}`,
            'CREATE_CLASS_ERROR',
            teacherError as any
          )
        }
      }

      return {
        id: data.id,
        code: data.class_code || data.id,
        name: data.class_name,
        description: data.description || description,
        gradeYear: data.class_grade_year,
        isActive: data.is_active ?? true,
        deactivatedAt: data.deactivated_at ?? null,
        studentIds: studentIds || [],
        teacherIds: teacherIds || [],
        createdAt: data.created_at,
        updatedAt: data.updated_at || data.created_at,
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error creating class: ${err instanceof Error ? err.message : String(err)}`,
        'CREATE_CLASS_ERROR',
        err as any
      )
    }
  }

  /**
   * Update class
   */
  async updateClass(
    id: string,
    updates: {
      name?: string,
      code?: string,
      gradeYear?: number,
      isActive?: boolean,
      description?: string,
      studentIds?: string[],
      teacherIds?: string[]
    },
    options: ClassWriteOptions = {}
  ): Promise<Class> {
    try {
      const supabase = getSupabaseClient()
      const { data: existingClass, error: existingError } = await supabase
        .from('classes')
        .select('*')
        .eq('id', id)
        .single()

      if (existingError || !existingClass) {
        throw new AdminServiceError(
          `Failed to load class before update: ${existingError?.message || 'Class not found'}`,
          'UPDATE_CLASS_ERROR',
          existingError as any
        )
      }

      await this.validateClassWriteInput({
        idToExclude: id,
        name: updates.name ?? existingClass.class_name,
        code: existingClass.class_code || existingClass.id,
        gradeYear: updates.gradeYear ?? existingClass.class_grade_year,
      })

      const updatePayload: any = {}
      if (updates.name !== undefined) updatePayload.class_name = updates.name
      if (updates.description !== undefined) updatePayload.description = updates.description || null
      if (updates.gradeYear !== undefined) updatePayload.class_grade_year = updates.gradeYear
      if (updates.isActive !== undefined) updatePayload.is_active = updates.isActive

      const { data, error } = await supabase
        .from('classes')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        throw new AdminServiceError(
          `Failed to update class: ${error.message}`,
          'UPDATE_CLASS_ERROR',
          error as any
        )
      }

      await this.writeClassAudit(
        id,
        updates.isActive === undefined
          ? 'update'
          : updates.isActive
            ? 'activate'
            : 'deactivate',
        {
          class_name: existingClass.class_name,
          class_grade_year: existingClass.class_grade_year,
          description: existingClass.description || null,
          is_active: existingClass.is_active ?? true,
        },
        {
          class_name: data.class_name,
          class_grade_year: data.class_grade_year,
          description: data.description || null,
          is_active: data.is_active ?? true,
        },
        options.actorId
      )

      // Handle student enrollments if provided
      if (updates.studentIds !== undefined) {
        // Get current enrollments for this class
        const { data: currentEnrollments, error: enrollError } = await supabase
          .from('student_class_enrollment')
          .select('student_id, family_id')
          .eq('class_id', id)

        if (enrollError) {
          console.error('Failed to fetch current enrollments:', enrollError)
        }

        const currentStudentIds = (currentEnrollments || []).map((e: any) => e.student_id)
        const newStudentIds = updates.studentIds

        // Remove students that are no longer in the list
        const toRemove = currentStudentIds.filter((sid: string) => !newStudentIds.includes(sid))
        if (toRemove.length > 0) {
          const { error: deleteError } = await supabase
            .from('student_class_enrollment')
            .delete()
            .eq('class_id', id)
            .in('student_id', toRemove)

          if (deleteError) {
            console.error('Failed to remove students from class:', deleteError)
          }
        }

        // Add new students
        const toAdd = newStudentIds.filter((sid: string) => !currentStudentIds.includes(sid))
        if (toAdd.length > 0) {
          // Get family_id for each student from family_enrollment table
          const { data: familyEnrollments, error: familyError } = await supabase
            .from('family_enrollment')
            .select('student_id, family_id')
            .in('student_id', toAdd)

          if (familyError) {
            console.error('Failed to fetch family enrollments:', familyError)
          }

          // Create a map of student_id -> family_id
          const studentFamilyMap = new Map<string, string>()
          ;(familyEnrollments || []).forEach((enrollment: any) => {
            studentFamilyMap.set(enrollment.student_id, enrollment.family_id)
          })

          // Build enrollments with correct family_id
          const enrollmentsToAdd = toAdd.map((studentId: string) => ({
            class_id: id,
            student_id: studentId,
            family_id: studentFamilyMap.get(studentId) || '', // Use family from enrollment or empty if not found
          }))

          const { error: insertError } = await supabase
            .from('student_class_enrollment')
            .insert(enrollmentsToAdd)

          if (insertError) {
            console.error('Failed to add students to class:', insertError)
          }
        }
      }

      // Handle teacher assignments if provided
      if (updates.teacherIds !== undefined) {
        // Get current teacher assignments for this class
        const { data: currentAssignments, error: assignError } = await supabase
          .from('teacher_class_assignment')
          .select('teacher_id')
          .eq('class_id', id)

        if (assignError) {
          throw new AdminServiceError(
            `Failed to fetch current teacher assignments: ${assignError.message}`,
            'UPDATE_CLASS_ERROR',
            assignError as any
          )
        }

        const currentTeacherIds = (currentAssignments || []).map((a: any) => a.teacher_id)
        const newTeacherIds = updates.teacherIds

        // Remove teachers that are no longer in the list
        const toRemove = currentTeacherIds.filter((tid: string) => !newTeacherIds.includes(tid))
        if (toRemove.length > 0) {
          const { error: deleteError } = await supabase
            .from('teacher_class_assignment')
            .delete()
            .eq('class_id', id)
            .in('teacher_id', toRemove)

          if (deleteError) {
            throw new AdminServiceError(
              `Failed to remove teachers from class: ${deleteError.message}`,
              'UPDATE_CLASS_ERROR',
              deleteError as any
            )
          }
        }

        // Add new teachers
        const toAdd = newTeacherIds.filter((tid: string) => !currentTeacherIds.includes(tid))
        if (toAdd.length > 0) {
          const assignmentsToAdd = toAdd.map((teacherId: string) => ({
            class_id: id,
            teacher_id: teacherId,
          }))

          const { error: insertError } = await supabase
            .from('teacher_class_assignment')
            .insert(assignmentsToAdd)

          if (insertError) {
            throw new AdminServiceError(
              `Failed to add teachers to class: ${insertError.message}`,
              'UPDATE_CLASS_ERROR',
              insertError as any
            )
          }
        }
      }

      return {
        id: data.id,
        code: data.class_code || data.id,
        name: data.class_name,
        description: data.description || updates.description,
        gradeYear: data.class_grade_year,
        isActive: data.is_active ?? true,
        deactivatedAt: data.deactivated_at ?? null,
        studentIds: updates.studentIds || [],
        teacherIds: updates.teacherIds || [],
        createdAt: data.created_at,
        updatedAt: data.updated_at || data.created_at,
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error updating class: ${err instanceof Error ? err.message : String(err)}`,
        'UPDATE_CLASS_ERROR',
        err as any
      )
    }
  }

  /**
   * Delete class
   */
  async deleteClass(id: string): Promise<void> {
    await this.deactivateClass(id)
  }

  async activateClass(id: string, options: ClassWriteOptions = {}): Promise<Class> {
    try {
      const supabase = getSupabaseClient()

      const { data: existingClass, error: existingError } = await supabase
        .from('classes')
        .select('*')
        .eq('id', id)
        .single()

      if (existingError || !existingClass) {
        throw new AdminServiceError(
          `Failed to load class: ${existingError?.message || 'Class not found'}`,
          'ACTIVATE_CLASS_ERROR',
          existingError as any
        )
      }

      const { data, error } = await supabase
        .from('classes')
        .update({ is_active: true })
        .eq('id', id)
        .select('*')
        .single()

      if (error || !data) {
        throw new AdminServiceError(
          `Failed to activate class: ${error?.message || 'Unknown error'}`,
          'ACTIVATE_CLASS_ERROR',
          error as any
        )
      }

      await this.writeClassAudit(
        id,
        'activate',
        {
          class_name: existingClass.class_name,
          class_grade_year: existingClass.class_grade_year,
          description: existingClass.description || null,
          is_active: existingClass.is_active ?? true,
        },
        {
          class_name: data.class_name,
          class_grade_year: data.class_grade_year,
          description: data.description || null,
          is_active: data.is_active ?? true,
        },
        options.actorId
      )

      return {
        id: data.id,
        code: data.class_code || data.id,
        name: data.class_name,
        description: data.description || '',
        gradeYear: data.class_grade_year,
        isActive: data.is_active ?? true,
        deactivatedAt: data.deactivated_at ?? null,
        studentIds: [],
        teacherIds: [],
        createdAt: data.created_at,
        updatedAt: data.updated_at || data.created_at,
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error activating class: ${err instanceof Error ? err.message : String(err)}`,
        'ACTIVATE_CLASS_ERROR',
        err as any
      )
    }
  }

  async deactivateClass(id: string, options: ClassWriteOptions = {}): Promise<Class> {
    try {
      const supabase = getSupabaseClient()

      const { data: existingClass, error: existingError } = await supabase
        .from('classes')
        .select('*')
        .eq('id', id)
        .single()

      if (existingError || !existingClass) {
        throw new AdminServiceError(
          `Failed to load class: ${existingError?.message || 'Class not found'}`,
          'DEACTIVATE_CLASS_ERROR',
          existingError as any
        )
      }

      const { data, error } = await supabase
        .from('classes')
        .update({ is_active: false })
        .eq('id', id)
        .select('*')
        .single()

      if (error || !data) {
        throw new AdminServiceError(
          `Failed to deactivate class: ${error?.message || 'Unknown error'}`,
          'DEACTIVATE_CLASS_ERROR',
          error as any
        )
      }

      await this.writeClassAudit(
        id,
        'deactivate',
        {
          class_name: existingClass.class_name,
          class_grade_year: existingClass.class_grade_year,
          description: existingClass.description || null,
          is_active: existingClass.is_active ?? true,
        },
        {
          class_name: data.class_name,
          class_grade_year: data.class_grade_year,
          description: data.description || null,
          is_active: data.is_active ?? true,
        },
        options.actorId
      )

      return {
        id: data.id,
        code: data.class_code || data.id,
        name: data.class_name,
        description: data.description || '',
        gradeYear: data.class_grade_year,
        isActive: data.is_active ?? true,
        deactivatedAt: data.deactivated_at ?? null,
        studentIds: [],
        teacherIds: [],
        createdAt: data.created_at,
        updatedAt: data.updated_at || data.created_at,
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error deactivating class: ${err instanceof Error ? err.message : String(err)}`,
        'DEACTIVATE_CLASS_ERROR',
        err as any
      )
    }
  }

  /**
   * Add student to class
   */
  async addStudentToClass(classId: string, studentId: string): Promise<void> {
    try {
      const supabase = getSupabaseClient()

      // First, fetch the class to get existing students
      const { data: classData, error: fetchError } = await supabase
        .from('classes')
        .select('student_ids')
        .eq('id', classId)
        .single()

      if (fetchError) {
        throw new AdminServiceError(
          `Failed to fetch class: ${fetchError.message}`,
          'FETCH_CLASS_ERROR',
          fetchError as any
        )
      }

      const studentIds = classData?.student_ids || []
      if (!studentIds.includes(studentId)) {
        studentIds.push(studentId)
      }

      // Update the class with new student list
      const { error: updateError } = await supabase
        .from('classes')
        .update({ student_ids: studentIds, updated_at: new Date().toISOString() })
        .eq('id', classId)

      if (updateError) {
        throw new AdminServiceError(
          `Failed to add student to class: ${updateError.message}`,
          'ADD_STUDENT_ERROR',
          updateError as any
        )
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error adding student to class: ${err instanceof Error ? err.message : String(err)}`,
        'ADD_STUDENT_ERROR',
        err as any
      )
    }
  }

  /**
   * Remove student from class
   */
  async removeStudentFromClass(classId: string, studentId: string): Promise<void> {
    try {
      const supabase = getSupabaseClient()

      // First, fetch the class to get existing students
      const { data: classData, error: fetchError } = await supabase
        .from('classes')
        .select('student_ids')
        .eq('id', classId)
        .single()

      if (fetchError) {
        throw new AdminServiceError(
          `Failed to fetch class: ${fetchError.message}`,
          'FETCH_CLASS_ERROR',
          fetchError as any
        )
      }

      const studentIds = (classData?.student_ids || []).filter(
        (id: string) => id !== studentId
      )

      // Update the class with new student list
      const { error: updateError } = await supabase
        .from('classes')
        .update({ student_ids: studentIds, updated_at: new Date().toISOString() })
        .eq('id', classId)

      if (updateError) {
        throw new AdminServiceError(
          `Failed to remove student from class: ${updateError.message}`,
          'REMOVE_STUDENT_ERROR',
          updateError as any
        )
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error removing student from class: ${err instanceof Error ? err.message : String(err)}`,
        'REMOVE_STUDENT_ERROR',
        err as any
      )
    }
  }

  /**
   * ============ FAMILY OPERATIONS ============
   */

  /**
   * Fetch families (active by default)
   */
  async fetchFamilies(options: FetchFamiliesOptions = {}): Promise<Family[]> {
    try {
      const supabase = getSupabaseClient()
      let query = supabase
        .from('families')
        .select('*')
        .order('family_code', { ascending: true })

      if (!options.includeInactive) {
        query = query.eq('is_active', true)
      }

      const { data, error } = await query

      if (error) {
        throw new AdminServiceError(
          `Failed to fetch families: ${error.message}`,
          'FETCH_FAMILIES_ERROR',
          error as any
        )
      }

      return (data || []).map((row: any) => this.mapFamilyRow(row))
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching families: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_FAMILIES_ERROR',
        err as any
      )
    }
  }

  /**
   * Create family
   */
  async createFamily(
    name: string,
    description?: string,
    relatedTopics?: string[],
    guardianEmail?: string,
    options: FamilyWriteOptions = {}
  ): Promise<Family> {
    try {
      await this.validateFamilyWriteInput({ name, guardianEmail })
      const supabase = getSupabaseClient()
      const normalizedName = name.trim()
      const normalizedCode = this.normalizeFamilyCode(normalizedName)
      const normalizedEmail = (guardianEmail || '').trim().toLowerCase()

      const { data, error } = await supabase
        .from('families')
        .insert({
          family_code: normalizedCode,
          family_name: normalizedName,
          guardian_email: normalizedEmail,
          description: description?.trim() || null,
          related_topics: relatedTopics || [],
          is_active: true,
        })
        .select()
        .single()

      if (error) {
        throw new AdminServiceError(
          `Failed to create family: ${error.message}`,
          'CREATE_FAMILY_ERROR',
          error as any
        )
      }

      await this.writeFamilyAudit(
        data.id,
        'create',
        null,
        {
          family_name: data.family_name || data.family_code,
          family_code: data.family_code,
          guardian_email: data.guardian_email,
          is_active: data.is_active ?? true,
        },
        options.actorId
      )

      return this.mapFamilyRow(data)
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error creating family: ${err instanceof Error ? err.message : String(err)}`,
        'CREATE_FAMILY_ERROR',
        err as any
      )
    }
  }

  /**
   * Update family
   */
  async updateFamily(
    id: string,
    updates: {
      name?: string,
      guardianEmail?: string,
      description?: string,
      relatedTopics?: string[]
    },
    options: FamilyWriteOptions = {}
  ): Promise<Family> {
    try {
      const supabase = getSupabaseClient()
      const { data: existing, error: existingError } = await supabase
        .from('families')
        .select('*')
        .eq('id', id)
        .single()

      if (existingError || !existing) {
        throw new AdminServiceError(
          `Failed to load family: ${existingError?.message || 'Family not found'}`,
          'UPDATE_FAMILY_ERROR',
          existingError as any
        )
      }

      const updatePayload: any = {}
      const resolvedName = updates.name ?? existing.family_name ?? existing.family_code
      const resolvedGuardianEmail = updates.guardianEmail ?? existing.guardian_email
      await this.validateFamilyWriteInput({
        idToExclude: id,
        name: resolvedName,
        guardianEmail: resolvedGuardianEmail,
      })

      if (updates.name !== undefined) {
        const normalizedName = updates.name.trim()
        updatePayload.family_name = normalizedName
        updatePayload.family_code = this.normalizeFamilyCode(normalizedName)
      }
      if (updates.guardianEmail !== undefined) {
        updatePayload.guardian_email = updates.guardianEmail.trim().toLowerCase()
      }
      if (updates.description !== undefined) {
        updatePayload.description = updates.description.trim() || null
      }
      if (updates.relatedTopics !== undefined) {
        updatePayload.related_topics = updates.relatedTopics
      }

      const { data, error } = await supabase
        .from('families')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        throw new AdminServiceError(
          `Failed to update family: ${error.message}`,
          'UPDATE_FAMILY_ERROR',
          error as any
        )
      }

      await this.writeFamilyAudit(
        id,
        'update',
        {
          family_name: existing.family_name || existing.family_code,
          family_code: existing.family_code,
          guardian_email: existing.guardian_email,
          description: existing.description,
          related_topics: existing.related_topics || [],
          is_active: existing.is_active ?? true,
        },
        {
          family_name: data.family_name || data.family_code,
          family_code: data.family_code,
          guardian_email: data.guardian_email,
          description: data.description,
          related_topics: data.related_topics || [],
          is_active: data.is_active ?? true,
        },
        options.actorId
      )

      return this.mapFamilyRow(data)
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error updating family: ${err instanceof Error ? err.message : String(err)}`,
        'UPDATE_FAMILY_ERROR',
        err as any
      )
    }
  }

  /**
   * Delete family
   */
  async deleteFamily(id: string): Promise<void> {
    await this.deactivateFamily(id)
  }

  async activateFamily(id: string, options: FamilyWriteOptions = {}): Promise<Family> {
    try {
      const supabase = getSupabaseClient()
      const { data: existing, error: existingError } = await supabase
        .from('families')
        .select('*')
        .eq('id', id)
        .single()

      if (existingError || !existing) {
        throw new AdminServiceError(
          `Failed to load family: ${existingError?.message || 'Family not found'}`,
          'ACTIVATE_FAMILY_ERROR',
          existingError as any
        )
      }

      const { data, error } = await supabase
        .from('families')
        .update({ is_active: true })
        .eq('id', id)
        .select('*')
        .single()

      if (error || !data) {
        throw new AdminServiceError(
          `Failed to activate family: ${error?.message || 'Unknown error'}`,
          'ACTIVATE_FAMILY_ERROR',
          error as any
        )
      }

      await this.writeFamilyAudit(
        id,
        'activate',
        { is_active: existing.is_active ?? true, deactivated_at: existing.deactivated_at ?? null },
        { is_active: data.is_active ?? true, deactivated_at: data.deactivated_at ?? null },
        options.actorId
      )

      return this.mapFamilyRow(data)
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error activating family: ${err instanceof Error ? err.message : String(err)}`,
        'ACTIVATE_FAMILY_ERROR',
        err as any
      )
    }
  }

  async deactivateFamily(id: string, options: FamilyWriteOptions = {}): Promise<Family> {
    try {
      const supabase = getSupabaseClient()
      const { data: existing, error: existingError } = await supabase
        .from('families')
        .select('*')
        .eq('id', id)
        .single()

      if (existingError || !existing) {
        throw new AdminServiceError(
          `Failed to load family: ${existingError?.message || 'Family not found'}`,
          'DEACTIVATE_FAMILY_ERROR',
          existingError as any
        )
      }

      const { data, error } = await supabase
        .from('families')
        .update({ is_active: false })
        .eq('id', id)
        .select('*')
        .single()

      if (error || !data) {
        throw new AdminServiceError(
          `Failed to deactivate family: ${error?.message || 'Unknown error'}`,
          'DEACTIVATE_FAMILY_ERROR',
          error as any
        )
      }

      await this.writeFamilyAudit(
        id,
        'deactivate',
        { is_active: existing.is_active ?? true, deactivated_at: existing.deactivated_at ?? null },
        { is_active: data.is_active ?? true, deactivated_at: data.deactivated_at ?? null },
        options.actorId
      )

      return this.mapFamilyRow(data)
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error deactivating family: ${err instanceof Error ? err.message : String(err)}`,
        'DEACTIVATE_FAMILY_ERROR',
        err as any
      )
    }
  }

  /**
   * Get family members (parents and students)
   */
  async getFamilyMembers(familyId: string): Promise<Array<{ id: string; name: string; email: string; type: 'parent' | 'student'; relationship?: 'father' | 'mother' | 'guardian'; classes?: Array<{ id: string; name: string }> }>> {
    try {
      const supabase = getSupabaseClient()

      // Fetch all family enrollment records for this family
      const { data: enrollments, error: enrollError } = await supabase
        .from('family_enrollment')
        .select('*')
        .eq('family_id', familyId)

      if (enrollError) {
        throw new AdminServiceError(
          `Failed to fetch family members: ${enrollError.message}`,
          'FETCH_FAMILY_MEMBERS_ERROR',
          enrollError as any
        )
      }

      if (!enrollments || enrollments.length === 0) {
        return []
      }

      // Separate parent and student IDs
      const parentIds = enrollments
        .filter((e: any) => e.parent_id)
        .map((e: any) => e.parent_id)
      const studentIds = enrollments
        .filter((e: any) => e.student_id)
        .map((e: any) => e.student_id)

      // Fetch parent user data
      const parents: any[] = []
      if (parentIds.length > 0) {
        const { data: parentUsers, error: parentError } = await supabase
          .from('user_roles')
          .select('id, email, role')
          .in('id', parentIds)

        if (parentError) {
          throw new AdminServiceError(
            `Failed to fetch parents: ${parentError.message}`,
            'FETCH_PARENTS_ERROR',
            parentError as any
          )
        }

        if (parentUsers) {
          parents.push(...parentUsers)
        }
      }

      // Fetch student user data
      const students: any[] = []
      if (studentIds.length > 0) {
        const { data: studentUsers, error: studentError } = await supabase
          .from('students')
          .select('*')
          .in('id', studentIds)

        if (studentError) {
          throw new AdminServiceError(
            `Failed to fetch students: ${studentError.message}`,
            'FETCH_STUDENTS_ERROR',
            studentError as any
          )
        }

        if (studentUsers) {
          students.push(...studentUsers)
        }
      }

      // Fetch student-class enrollments for all students in this family
      const studentClassMap = new Map<string, Array<{ id: string; name: string }>>()
      if (studentIds.length > 0) {
        const { data: enrollmentData, error: classError } = await supabase
          .from('student_class_enrollment')
          .select('student_id, class_id')
          .in('student_id', studentIds)

        if (classError) {
          console.error('Failed to fetch student-class enrollments:', classError)
        }

        if (enrollmentData && enrollmentData.length > 0) {
          // Get unique class IDs
          const classIds = [...new Set(enrollmentData.map((e: any) => e.class_id))]

          // Fetch class data
          const { data: classData, error: classFetchError } = await supabase
            .from('classes')
            .select('id, class_name')
            .in('id', classIds)

          if (classFetchError) {
            console.error('Failed to fetch class data:', classFetchError)
          } else if (classData) {
            // Build map of student_id -> classes
            enrollmentData.forEach((enrollment: any) => {
              const classInfo = classData.find((c: any) => c.id === enrollment.class_id)
              if (classInfo) {
                if (!studentClassMap.has(enrollment.student_id)) {
                  studentClassMap.set(enrollment.student_id, [])
                }
                studentClassMap.get(enrollment.student_id)!.push({
                  id: classInfo.id,
                  name: classInfo.class_name,
                })
              }
            })
          }
        }
      }

      // Map enrollment records to family members
      const members = enrollments.map((enrollment: any) => {
        if (enrollment.parent_id) {
          const parent = parents.find((p: any) => p.id === enrollment.parent_id)
          return {
            id: enrollment.parent_id,
            name: parent?.email || 'Unknown',
            email: parent?.email || 'Unknown',
            type: 'parent' as const,
            relationship: enrollment.relationship as 'father' | 'mother' | 'guardian' | undefined,
          }
        } else {
          const student = students.find((s: any) => s.id === enrollment.student_id)
          return {
            id: enrollment.student_id,
            name: student?.name || 'Unknown',
            email: student?.email || 'Unknown',
            type: 'student' as const,
            classes: studentClassMap.get(enrollment.student_id) || [],
          }
        }
      })

      return members
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching family members: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_FAMILY_MEMBERS_ERROR',
        err as any
      )
    }
  }

  /**
   * Add parent to family
   */
  async addParentToFamily(
    familyId: string,
    parentId: string,
    relationship: 'father' | 'mother' | 'guardian'
  ): Promise<void> {
    try {
      const supabase = getSupabaseClient()

      const { error } = await supabase
        .from('family_enrollment')
        .insert({
          family_id: familyId,
          parent_id: parentId,
          relationship,
        })

      if (error) {
        throw new AdminServiceError(
          `Failed to add parent to family: ${error.message}`,
          'ADD_PARENT_ERROR',
          error as any
        )
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error adding parent to family: ${err instanceof Error ? err.message : String(err)}`,
        'ADD_PARENT_ERROR',
        err as any
      )
    }
  }

  /**
   * Remove parent from family
   */
  async removeParentFromFamily(familyId: string, parentId: string): Promise<void> {
    try {
      const supabase = getSupabaseClient()

      const { error } = await supabase
        .from('family_enrollment')
        .delete()
        .eq('family_id', familyId)
        .eq('parent_id', parentId)

      if (error) {
        throw new AdminServiceError(
          `Failed to remove parent from family: ${error.message}`,
          'REMOVE_PARENT_ERROR',
          error as any
        )
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error removing parent from family: ${err instanceof Error ? err.message : String(err)}`,
        'REMOVE_PARENT_ERROR',
        err as any
      )
    }
  }

  /**
   * Update parent relationship type
   */
  async updateParentRelationship(
    familyId: string,
    parentId: string,
    relationship: 'father' | 'mother' | 'guardian'
  ): Promise<void> {
    try {
      const supabase = getSupabaseClient()

      const { error } = await supabase
        .from('family_enrollment')
        .update({ relationship })
        .eq('family_id', familyId)
        .eq('parent_id', parentId)

      if (error) {
        throw new AdminServiceError(
          `Failed to update parent relationship: ${error.message}`,
          'UPDATE_RELATIONSHIP_ERROR',
          error as any
        )
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error updating parent relationship: ${err instanceof Error ? err.message : String(err)}`,
        'UPDATE_RELATIONSHIP_ERROR',
        err as any
      )
    }
  }

  /**
   * Add student to family
   */
  async addStudentToFamily(familyId: string, studentId: string): Promise<void> {
    try {
      const supabase = getSupabaseClient()
      const { data: family, error: familyError } = await supabase
        .from('families')
        .select('id, is_active')
        .eq('id', familyId)
        .single()

      if (familyError || !family) {
        throw new AdminServiceError(
          `Family ${familyId} not found`,
          'ADD_STUDENT_ERROR',
          familyError as any
        )
      }

      if (family.is_active === false) {
        throw new AdminServiceError(
          '已停用的家族無法新增學生，請先啟用家族',
          'FAMILY_ASSOCIATION_ERROR'
        )
      }

      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('id', studentId)
        .single()

      if (studentError || !student) {
        throw new AdminServiceError(
          `Student ${studentId} not found`,
          'FAMILY_ASSOCIATION_ERROR',
          studentError as any
        )
      }

      const { data: existingLink, error: linkError } = await supabase
        .from('family_enrollment')
        .select('id')
        .eq('family_id', familyId)
        .eq('student_id', studentId)
        .maybeSingle()

      if (linkError) {
        throw new AdminServiceError(
          `Failed to validate family association: ${linkError.message}`,
          'FAMILY_ASSOCIATION_ERROR',
          linkError as any
        )
      }

      if (existingLink) {
        throw new AdminServiceError(
          '學生已在此家族中',
          'FAMILY_ASSOCIATION_ERROR'
        )
      }

      const { error } = await supabase
        .from('family_enrollment')
        .insert({
          family_id: familyId,
          student_id: studentId,
          relationship: 'student',
        })

      if (error) {
        throw new AdminServiceError(
          `Failed to add student to family: ${error.message}`,
          'ADD_STUDENT_ERROR',
          error as any
        )
      }

      await this.writeFamilyAudit(
        familyId,
        'add_child',
        null,
        { student_id: studentId },
      )
      await this.writeStudentAudit(
        studentId,
        'add_family',
        null,
        { family_id: familyId }
      )
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error adding student to family: ${err instanceof Error ? err.message : String(err)}`,
        'ADD_STUDENT_ERROR',
        err as any
      )
    }
  }

  /**
   * Remove student from family
   */
  async removeStudentFromFamily(familyId: string, studentId: string): Promise<void> {
    try {
      const supabase = getSupabaseClient()
      const { data: existingLink, error: existingError } = await supabase
        .from('family_enrollment')
        .select('id')
        .eq('family_id', familyId)
        .eq('student_id', studentId)
        .maybeSingle()

      if (existingError) {
        throw new AdminServiceError(
          `Failed to verify student association: ${existingError.message}`,
          'REMOVE_STUDENT_ERROR',
          existingError as any
        )
      }

      if (!existingLink) {
        throw new AdminServiceError(
          '找不到該學生與家族的關聯',
          'FAMILY_ASSOCIATION_ERROR'
        )
      }

      const { error } = await supabase
        .from('family_enrollment')
        .delete()
        .eq('family_id', familyId)
        .eq('student_id', studentId)

      if (error) {
        throw new AdminServiceError(
          `Failed to remove student from family: ${error.message}`,
          'REMOVE_STUDENT_ERROR',
          error as any
        )
      }

      await this.writeFamilyAudit(
        familyId,
        'remove_child',
        { student_id: studentId },
        null,
      )
      await this.writeStudentAudit(
        studentId,
        'remove_family',
        { family_id: familyId },
        null
      )
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error removing student from family: ${err instanceof Error ? err.message : String(err)}`,
        'REMOVE_STUDENT_ERROR',
        err as any
      )
    }
  }

  /**
   * Add student to class enrollment table with explicit family linkage
   */
  async addStudentToClassEnrollment(classId: string, studentId: string, familyId: string): Promise<void> {
    try {
      const supabase = getSupabaseClient()
      const normalizedClassId = classId.trim()
      const normalizedStudentId = studentId.trim()
      const normalizedFamilyId = familyId.trim()

      if (!normalizedClassId) {
        throw new AdminServiceError('班級為必填項', 'ADD_STUDENT_CLASS_ENROLLMENT_ERROR')
      }
      if (!normalizedStudentId) {
        throw new AdminServiceError('學生為必填項', 'ADD_STUDENT_CLASS_ENROLLMENT_ERROR')
      }
      if (!normalizedFamilyId) {
        throw new AdminServiceError('家庭為必填項', 'ADD_STUDENT_CLASS_ENROLLMENT_ERROR')
      }

      const [studentResult, classResult, familyResult] = await Promise.all([
        supabase.from('students').select('id, is_active').eq('id', normalizedStudentId).single(),
        supabase.from('classes').select('id, is_active').eq('id', normalizedClassId).single(),
        supabase.from('families').select('id, is_active').eq('id', normalizedFamilyId).single(),
      ])
      const legacyStudentResult = (studentResult.error && this.isMissingStudentColumnError(studentResult.error, 'is_active'))
        ? await supabase.from('students').select('id').eq('id', normalizedStudentId).single()
        : null
      const resolvedStudentError = legacyStudentResult ? legacyStudentResult.error : studentResult.error
      const resolvedStudentData = legacyStudentResult ? legacyStudentResult.data : studentResult.data

      if (resolvedStudentError || !resolvedStudentData) {
        throw new AdminServiceError(
          `Unknown student: ${normalizedStudentId}`,
          'ADD_STUDENT_CLASS_ENROLLMENT_ERROR',
          resolvedStudentError as any
        )
      }
      if ((resolvedStudentData as any).is_active === false) {
        throw new AdminServiceError('停用學生無法加入班級', 'ADD_STUDENT_CLASS_ENROLLMENT_ERROR')
      }

      if (classResult.error || !classResult.data) {
        throw new AdminServiceError(
          `Unknown class: ${normalizedClassId}`,
          'ADD_STUDENT_CLASS_ENROLLMENT_ERROR',
          classResult.error as any
        )
      }
      if ((classResult.data as any).is_active === false) {
        throw new AdminServiceError('停用班級無法新增學生', 'ADD_STUDENT_CLASS_ENROLLMENT_ERROR')
      }

      if (familyResult.error || !familyResult.data) {
        throw new AdminServiceError(
          `Unknown family: ${normalizedFamilyId}`,
          'ADD_STUDENT_CLASS_ENROLLMENT_ERROR',
          familyResult.error as any
        )
      }
      if ((familyResult.data as any).is_active === false) {
        throw new AdminServiceError('停用家庭無法分配班級', 'ADD_STUDENT_CLASS_ENROLLMENT_ERROR')
      }

      const { data: familyLink, error: familyLinkError } = await supabase
        .from('family_enrollment')
        .select('id')
        .eq('family_id', normalizedFamilyId)
        .eq('student_id', normalizedStudentId)
        .maybeSingle()

      if (familyLinkError) {
        throw new AdminServiceError(
          `Failed to validate student-family relationship: ${familyLinkError.message}`,
          'ADD_STUDENT_CLASS_ENROLLMENT_ERROR',
          familyLinkError as any
        )
      }
      if (!familyLink) {
        throw new AdminServiceError('學生需先加入家庭，才能分配班級', 'ADD_STUDENT_CLASS_ENROLLMENT_ERROR')
      }

      const { data: existing, error: existingError } = await supabase
        .from('student_class_enrollment')
        .select('id')
        .eq('class_id', normalizedClassId)
        .eq('student_id', normalizedStudentId)
        .maybeSingle()

      if (existingError) {
        throw new AdminServiceError(
          `Failed to validate class enrollment: ${existingError.message}`,
          'ADD_STUDENT_CLASS_ENROLLMENT_ERROR',
          existingError as any
        )
      }

      if (existing) return

      const { error } = await supabase
        .from('student_class_enrollment')
        .insert({
          class_id: normalizedClassId,
          student_id: normalizedStudentId,
          family_id: normalizedFamilyId,
        })

      if (error) {
        throw new AdminServiceError(
          `Failed to assign student to class: ${error.message}`,
          'ADD_STUDENT_CLASS_ENROLLMENT_ERROR',
          error as any
        )
      }

      await this.writeStudentAudit(
        normalizedStudentId,
        'add_class',
        null,
        { class_id: normalizedClassId, family_id: normalizedFamilyId }
      )
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error assigning student to class: ${err instanceof Error ? err.message : String(err)}`,
        'ADD_STUDENT_CLASS_ENROLLMENT_ERROR',
        err as any
      )
    }
  }

  async removeStudentFromClassEnrollment(classId: string, studentId: string): Promise<void> {
    try {
      const supabase = getSupabaseClient()
      const normalizedClassId = classId.trim()
      const normalizedStudentId = studentId.trim()

      const { data: existing, error: existingError } = await supabase
        .from('student_class_enrollment')
        .select('id, family_id')
        .eq('class_id', normalizedClassId)
        .eq('student_id', normalizedStudentId)
        .maybeSingle()

      if (existingError) {
        throw new AdminServiceError(
          `Failed to validate class enrollment: ${existingError.message}`,
          'REMOVE_STUDENT_CLASS_ENROLLMENT_ERROR',
          existingError as any
        )
      }
      if (!existing) {
        throw new AdminServiceError('找不到該學生與班級關聯', 'REMOVE_STUDENT_CLASS_ENROLLMENT_ERROR')
      }

      const { error } = await supabase
        .from('student_class_enrollment')
        .delete()
        .eq('class_id', normalizedClassId)
        .eq('student_id', normalizedStudentId)

      if (error) {
        throw new AdminServiceError(
          `Failed to remove student class enrollment: ${error.message}`,
          'REMOVE_STUDENT_CLASS_ENROLLMENT_ERROR',
          error as any
        )
      }

      await this.writeStudentAudit(
        normalizedStudentId,
        'remove_class',
        { class_id: normalizedClassId, family_id: (existing as any).family_id },
        null
      )
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error removing student class enrollment: ${err instanceof Error ? err.message : String(err)}`,
        'REMOVE_STUDENT_CLASS_ENROLLMENT_ERROR',
        err as any
      )
    }
  }

  /**
   * Get available parents (not already in family)
   */
  async getAvailableParents(familyId: string): Promise<AdminUser[]> {
    try {
      const supabase = getSupabaseClient()

      // Get all parents with role 'parent' or 'teacher'
      const { data: allParents, error: fetchError } = await supabase
        .from('user_roles')
        .select('id, email, role, created_at, updated_at')
        .or('role.eq.parent,role.eq.teacher')
        .order('email', { ascending: true })

      if (fetchError) {
        throw new AdminServiceError(
          `Failed to fetch parents: ${fetchError.message}`,
          'FETCH_PARENTS_ERROR',
          fetchError as any
        )
      }

      if (!allParents) {
        return []
      }

      // Get parents already in this family
      const { data: enrollments, error: enrollError } = await supabase
        .from('family_enrollment')
        .select('parent_id')
        .eq('family_id', familyId)

      if (enrollError) {
        throw new AdminServiceError(
          `Failed to fetch family enrollments: ${enrollError.message}`,
          'FETCH_ENROLLMENTS_ERROR',
          enrollError as any
        )
      }

      const existingParentIds = (enrollments || []).map((e: any) => e.parent_id).filter(Boolean)

      // Filter out parents already in family
      return allParents
        .filter((p: any) => !existingParentIds.includes(p.id))
        .map((row: any) => ({
          id: row.id,
          email: row.email,
          name: row.email, // Use email as display name since user_roles table has no name column
          role: row.role,
          status: 'active' as const,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastLoginAt: null,
        }))
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching available parents: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_AVAILABLE_PARENTS_ERROR',
        err as any
      )
    }
  }

  /**
   * Get available students (not already in family)
   */
  async getAvailableStudents(familyId: string): Promise<AdminUser[]> {
    try {
      const supabase = getSupabaseClient()

      // Get all students
      const { data: allStudents, error: fetchError } = await supabase
        .from('students')
        .select('id, name, student_code, is_active, created_at, updated_at')
        .eq('is_active', true)
        .order('name', { ascending: true })

      let studentsData: any[] | null = allStudents as any[] | null
      let studentsError: any = fetchError
      if (studentsError && (this.isMissingStudentColumnError(studentsError, 'student_code') || this.isMissingStudentColumnError(studentsError, 'is_active'))) {
        const legacyStudents = await supabase
          .from('students')
          .select('id, name, created_at, updated_at')
          .order('name', { ascending: true })
        studentsData = legacyStudents.data as any
        studentsError = legacyStudents.error as any
      }

      if (studentsError) {
        throw new AdminServiceError(
          `Failed to fetch students: ${studentsError.message}`,
          'FETCH_STUDENTS_ERROR',
          studentsError as any
        )
      }

      if (!studentsData) {
        return []
      }

      // Get students already in this family
      const { data: enrollments, error: enrollError } = await supabase
        .from('family_enrollment')
        .select('student_id')
        .eq('family_id', familyId)

      if (enrollError) {
        throw new AdminServiceError(
          `Failed to fetch family enrollments: ${enrollError.message}`,
          'FETCH_ENROLLMENTS_ERROR',
          enrollError as any
        )
      }

      const existingStudentIds = (enrollments || []).map((e: any) => e.student_id).filter(Boolean)

      // Filter out students already in family
      return studentsData
        .filter((s: any) => !existingStudentIds.includes(s.id))
        .map((row: any) => ({
          id: row.id,
          email: row.student_code || row.name || '',
          name: row.name || 'Unknown',
          role: 'student' as const,
          status: 'active' as const,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastLoginAt: null,
        }))
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching available students: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_AVAILABLE_STUDENTS_ERROR',
        err as any
      )
    }
  }

  private normalizeStudentCode(input: string): string {
    return input.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '').toUpperCase()
  }

  private isMissingStudentColumnError(error: any, columnName: string): boolean {
    const message = String(error?.message || '')
    return error?.code === '42703' || message.includes(`students.${columnName}`) || message.includes('does not exist')
  }

  private mapStudentRow(row: any): AdminUser {
    const isActive = row.is_active ?? true
    return {
      id: row.id,
      email: row.student_code || row.name || '',
      name: row.name || 'Unknown',
      role: 'student',
      status: isActive ? 'active' : 'disabled',
      createdAt: row.created_at,
      updatedAt: row.updated_at || row.created_at,
      lastLoginAt: null,
    }
  }

  private async validateStudentWriteInput(input: {
    idToExclude?: string
    name?: string
  }): Promise<{ normalizedName: string; normalizedCode: string }> {
    const normalizedName = (input.name || '').trim()
    if (!normalizedName) {
      throw new AdminServiceError('學生姓名為必填項', 'STUDENT_VALIDATION_ERROR')
    }

    const normalizedCode = this.normalizeStudentCode(normalizedName)
    const supabase = getSupabaseClient()
    let duplicateRows: any[] = []
    const lifecycleQuery = await supabase
      .from('students')
      .select('id')
      .eq('is_active', true)
      .or(`student_code.ilike.${normalizedCode},name.ilike.${normalizedName}`)

    if (lifecycleQuery.error && (this.isMissingStudentColumnError(lifecycleQuery.error, 'student_code') || this.isMissingStudentColumnError(lifecycleQuery.error, 'is_active'))) {
      const legacyQuery = await supabase
        .from('students')
        .select('id')
        .ilike('name', normalizedName)
      if (legacyQuery.error) {
        throw new AdminServiceError(
          `Failed to validate student identity: ${legacyQuery.error.message}`,
          'STUDENT_VALIDATION_ERROR',
          legacyQuery.error as any
        )
      }
      duplicateRows = legacyQuery.data || []
    } else if (lifecycleQuery.error) {
      throw new AdminServiceError(
        `Failed to validate student identity: ${lifecycleQuery.error.message}`,
        'STUDENT_VALIDATION_ERROR',
        lifecycleQuery.error as any
      )
    } else {
      duplicateRows = lifecycleQuery.data || []
    }
    const duplicate = duplicateRows.find((row: any) => row.id !== input.idToExclude)
    if (duplicate) {
      throw new AdminServiceError('學生姓名已存在', 'STUDENT_VALIDATION_ERROR')
    }

    return { normalizedName, normalizedCode }
  }

  private async writeStudentAudit(
    studentId: string,
    action: 'create' | 'update' | 'activate' | 'deactivate' | 'add_class' | 'remove_class' | 'add_family' | 'remove_family',
    priorState: Record<string, unknown> | null,
    newState: Record<string, unknown> | null,
    actorId?: string
  ): Promise<void> {
    try {
      const supabase = getSupabaseClient()
      const resolvedActorId = actorId || await this.getCurrentAuthUserId()
      await supabase.from('student_audit_log').insert({
        student_id: studentId,
        action,
        actor_id: resolvedActorId,
        prior_state: priorState,
        new_state: newState,
      })
    } catch (error) {
      console.error('Failed to log student audit event:', error)
    }
  }

  /**
   * Fetch students for admin UI pickers
   */
  async fetchStudents(options: FetchStudentsOptions = {}): Promise<AdminUser[]> {
    try {
      const supabase = getSupabaseClient()
      let query = supabase
        .from('students')
        .select('id, name, student_code, is_active, created_at, updated_at')
        .order('name', { ascending: true })

      if (!options.includeInactive) {
        query = query.eq('is_active', true)
      }

      const queryResult = await query
      let data: any[] | null = queryResult.data as any[] | null
      let error: any = queryResult.error
      if (error && (this.isMissingStudentColumnError(error, 'student_code') || this.isMissingStudentColumnError(error, 'is_active'))) {
        const legacyQuery = await supabase
          .from('students')
          .select('id, name, created_at, updated_at')
          .order('name', { ascending: true })
        data = legacyQuery.data as any[] | null
        error = legacyQuery.error as any
      }

      if (error) {
        throw new AdminServiceError(
          `Failed to fetch students: ${error.message}`,
          'FETCH_STUDENTS_ERROR',
          error as any
        )
      }

      return (data || []).map((row: any) => this.mapStudentRow(row))
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching students: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_STUDENTS_ERROR',
        err as any
      )
    }
  }

  async createStudent(name: string, options: StudentWriteOptions = {}): Promise<AdminUser> {
    try {
      const { normalizedName, normalizedCode } = await this.validateStudentWriteInput({ name })
      const supabase = getSupabaseClient()
      let { data, error } = await supabase
        .from('students')
        .insert({
          name: normalizedName,
          student_code: normalizedCode,
          is_active: true,
        })
        .select('*')
        .single()

      if (error && (this.isMissingStudentColumnError(error, 'student_code') || this.isMissingStudentColumnError(error, 'is_active'))) {
        const legacyInsert = await supabase
          .from('students')
          .insert({ name: normalizedName })
          .select('*')
          .single()
        data = legacyInsert.data
        error = legacyInsert.error as any
      }

      if (error || !data) {
        throw new AdminServiceError(
          `Failed to create student: ${error?.message || 'Unknown error'}`,
          'CREATE_STUDENT_ERROR',
          error as any
        )
      }

      await this.writeStudentAudit(
        data.id,
        'create',
        null,
        {
          name: data.name,
          student_code: data.student_code,
          is_active: data.is_active ?? true,
        },
        options.actorId
      )

      return this.mapStudentRow(data)
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error creating student: ${err instanceof Error ? err.message : String(err)}`,
        'CREATE_STUDENT_ERROR',
        err as any
      )
    }
  }

  async updateStudent(id: string, updates: { name: string }, options: StudentWriteOptions = {}): Promise<AdminUser> {
    try {
      const supabase = getSupabaseClient()
      const { data: existing, error: existingError } = await supabase
        .from('students')
        .select('*')
        .eq('id', id)
        .single()

      if (existingError || !existing) {
        throw new AdminServiceError(
          `Failed to load student before update: ${existingError?.message || 'Student not found'}`,
          'UPDATE_STUDENT_ERROR',
          existingError as any
        )
      }

      const { normalizedName, normalizedCode } = await this.validateStudentWriteInput({
        idToExclude: id,
        name: updates.name,
      })

      let { data, error } = await supabase
        .from('students')
        .update({
          name: normalizedName,
          student_code: normalizedCode,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .maybeSingle()

      if (error && this.isMissingStudentColumnError(error, 'student_code')) {
        const legacyUpdate = await supabase
          .from('students')
          .update({
            name: normalizedName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('*')
          .maybeSingle()
        data = legacyUpdate.data
        error = legacyUpdate.error as any
      }

      if (error) {
        throw new AdminServiceError(
          `Failed to update student: ${error.message}`,
          'UPDATE_STUDENT_ERROR',
          error as any
        )
      }

      if (!data) {
        throw new AdminServiceError(
          'Failed to update student: no matching student row was returned. Please ensure the student exists and latest write-policy migration has been applied.',
          'UPDATE_STUDENT_ERROR'
        )
      }

      await this.writeStudentAudit(
        id,
        'update',
        {
          name: existing.name,
          student_code: existing.student_code,
          is_active: existing.is_active ?? true,
        },
        {
          name: data.name,
          student_code: data.student_code,
          is_active: data.is_active ?? true,
        },
        options.actorId
      )

      return this.mapStudentRow(data)
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error updating student: ${err instanceof Error ? err.message : String(err)}`,
        'UPDATE_STUDENT_ERROR',
        err as any
      )
    }
  }

  async activateStudent(id: string, options: StudentWriteOptions = {}): Promise<AdminUser> {
    try {
      const supabase = getSupabaseClient()
      const { data: existing, error: existingError } = await supabase
        .from('students')
        .select('*')
        .eq('id', id)
        .single()
      if (existingError || !existing) {
        throw new AdminServiceError(`Student ${id} not found`, 'ACTIVATE_STUDENT_ERROR', existingError as any)
      }

      let { data, error } = await supabase
        .from('students')
        .update({ is_active: true })
        .eq('id', id)
        .select('*')
        .single()
      if (error && this.isMissingStudentColumnError(error, 'is_active')) {
        return this.mapStudentRow(existing)
      }
      if (error || !data) {
        throw new AdminServiceError(`Failed to activate student: ${error?.message || 'Unknown error'}`, 'ACTIVATE_STUDENT_ERROR', error as any)
      }

      await this.writeStudentAudit(id, 'activate', { is_active: existing.is_active ?? true }, { is_active: true }, options.actorId)
      return this.mapStudentRow(data)
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(`Error activating student: ${err instanceof Error ? err.message : String(err)}`, 'ACTIVATE_STUDENT_ERROR', err as any)
    }
  }

  async deactivateStudent(id: string, options: StudentWriteOptions = {}): Promise<AdminUser> {
    try {
      const supabase = getSupabaseClient()
      const { data: existing, error: existingError } = await supabase
        .from('students')
        .select('*')
        .eq('id', id)
        .single()
      if (existingError || !existing) {
        throw new AdminServiceError(`Student ${id} not found`, 'DEACTIVATE_STUDENT_ERROR', existingError as any)
      }

      let { data, error } = await supabase
        .from('students')
        .update({ is_active: false })
        .eq('id', id)
        .select('*')
        .single()
      if (error && this.isMissingStudentColumnError(error, 'is_active')) {
        throw new AdminServiceError('目前資料庫尚未升級學生停用欄位，請先執行 migration up。', 'DEACTIVATE_STUDENT_ERROR', error as any)
      }
      if (error || !data) {
        throw new AdminServiceError(`Failed to deactivate student: ${error?.message || 'Unknown error'}`, 'DEACTIVATE_STUDENT_ERROR', error as any)
      }

      await this.writeStudentAudit(id, 'deactivate', { is_active: existing.is_active ?? true }, { is_active: false }, options.actorId)
      return this.mapStudentRow(data)
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(`Error deactivating student: ${err instanceof Error ? err.message : String(err)}`, 'DEACTIVATE_STUDENT_ERROR', err as any)
    }
  }

  async deleteStudent(id: string): Promise<void> {
    await this.deactivateStudent(id)
  }

  async fetchParents(): Promise<AdminUser[]> {
    try {
      const parents = await this.fetchUsers('parent')
      return parents.map((parent) => ({
        ...parent,
        name: parent.name || parent.email,
      }))
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching parents: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_PARENTS_ERROR',
        err as any
      )
    }
  }

  async createParent(email: string): Promise<AdminUser> {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      throw new AdminServiceError('家長/監護人電子郵件為必填項', 'CREATE_PARENT_ERROR')
    }

    return this.createUser(normalizedEmail, normalizedEmail, 'parent', 'active')
  }

  async updateParent(id: string, updates: { name: string }): Promise<AdminUser> {
    try {
      const normalizedName = updates.name.trim()
      if (!normalizedName) {
        throw new AdminServiceError('家長/監護人名稱為必填項', 'UPDATE_PARENT_ERROR')
      }

      const supabase = getSupabaseClient()
      const { data, error } = await supabase.rpc('admin_update_user_display_name', {
        target_user_id: id,
        target_display_name: normalizedName,
      })

      if (error) {
        throw new AdminServiceError(
          `Failed to update parent/guardian: ${error.message}`,
          'UPDATE_PARENT_ERROR',
          error as any
        )
      }

      if (!data) {
        throw new AdminServiceError(
          'Failed to update parent/guardian: no matching parent row was returned.',
          'UPDATE_PARENT_ERROR'
        )
      }

      if (data.role !== 'parent') {
        throw new AdminServiceError(
          'Failed to update parent/guardian: selected user is not a parent role.',
          'UPDATE_PARENT_ERROR'
        )
      }

      return {
        id: data.id,
        email: data.email,
        name: data.display_name || data.name || data.email,
        role: 'parent',
        status: (data.status || 'active') as 'active' | 'disabled' | 'pending_approval',
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        lastLoginAt: data.last_login_at,
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error updating parent/guardian: ${err instanceof Error ? err.message : String(err)}`,
        'UPDATE_PARENT_ERROR',
        err as any
      )
    }
  }

  async deleteParent(id: string): Promise<void> {
    await this.deleteUser(id)
  }

  /**
   * ============ USER OPERATIONS ============
   */

  /**
   * ============ TEACHER OPERATIONS ============
   */
  async fetchTeachers(options: FetchTeachersOptions = {}): Promise<AdminUser[]> {
    try {
      const supabase = getSupabaseClient()
      let query = supabase
        .from('user_roles')
        .select(`
          id,
          email,
          role,
          created_at,
          updated_at,
          teacher_profiles (
            display_name,
            status,
            is_active,
            deactivated_at,
            updated_at
          )
        `)
        .eq('role', 'teacher')
        .order('email', { ascending: true })

      if (!options.includeInactive) {
        query = query.eq('teacher_profiles.is_active', true)
      }

      const { data, error } = await query
      if (error) {
        throw new AdminServiceError(
          `Failed to fetch teachers: ${error.message}`,
          'FETCH_TEACHERS_ERROR',
          error as any
        )
      }

      return (data || []).map((row: any) => {
        const profile = row.teacher_profiles?.[0] || {}
        return {
          id: row.id,
          email: row.email,
          name: profile.display_name || row.email,
          role: 'teacher' as const,
          status: (profile.status || 'active') as 'active' | 'disabled' | 'pending_approval',
          createdAt: row.created_at,
          updatedAt: profile.updated_at || row.updated_at,
          lastLoginAt: null,
        }
      })
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching teachers: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_TEACHERS_ERROR',
        err as any
      )
    }
  }

  async createTeacher(
    email: string,
    name: string,
    options: TeacherWriteOptions = {},
  ): Promise<AdminUser> {
    await this.validateTeacherWriteInput({ email, name })
    const supabase = getSupabaseClient()

    try {
      const user = await this.createUser(email, name, 'teacher', 'active')

      const { error: profileError } = await supabase
        .from('teacher_profiles')
        .insert({
          user_id: user.id,
          display_name: name.trim(),
          status: 'active',
          is_active: true,
        })

      if (profileError) {
        throw new AdminServiceError(
          `Failed to create teacher profile: ${profileError.message}`,
          'CREATE_TEACHER_ERROR',
          profileError as any
        )
      }

      await this.writeTeacherAudit(
        user.id,
        'create',
        null,
        { email: user.email, display_name: name.trim(), status: 'active', is_active: true },
        options.actorId,
      )

      return { ...user, name: name.trim(), status: 'active' }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error creating teacher: ${err instanceof Error ? err.message : String(err)}`,
        'CREATE_TEACHER_ERROR',
        err as any
      )
    }
  }

  async updateTeacher(
    id: string,
    updates: { name?: string },
    options: TeacherWriteOptions = {},
  ): Promise<AdminUser> {
    const supabase = getSupabaseClient()
    try {
      const { data: existing, error: existingError } = await supabase
        .from('user_roles')
        .select(`
          id,
          email,
          role,
          created_at,
          updated_at,
          teacher_profiles (
            display_name,
            status,
            is_active
          )
        `)
        .eq('id', id)
        .eq('role', 'teacher')
        .single()

      if (existingError || !existing) {
        throw new AdminServiceError(
          `Teacher not found: ${existingError?.message || id}`,
          'UPDATE_TEACHER_ERROR',
          existingError as any
        )
      }

      await this.validateTeacherWriteInput({
        idToExclude: id,
        email: existing.email,
        name: updates.name ?? existing.teacher_profiles?.[0]?.display_name,
      })

      const priorState = {
        display_name: existing.teacher_profiles?.[0]?.display_name || existing.email,
        status: existing.teacher_profiles?.[0]?.status || 'active',
        is_active: existing.teacher_profiles?.[0]?.is_active ?? true,
      }

      const { error } = await supabase
        .from('teacher_profiles')
        .update({
          display_name: updates.name?.trim() || existing.teacher_profiles?.[0]?.display_name || existing.email,
        })
        .eq('user_id', id)

      if (error) {
        throw new AdminServiceError(
          `Failed to update teacher: ${error.message}`,
          'UPDATE_TEACHER_ERROR',
          error as any
        )
      }

      const { data: updatedProfile, error: profileError } = await supabase
        .from('teacher_profiles')
        .select('*')
        .eq('user_id', id)
        .single()

      if (profileError || !updatedProfile) {
        throw new AdminServiceError(
          `Failed to load updated teacher profile: ${profileError?.message || id}`,
          'UPDATE_TEACHER_ERROR',
          profileError as any
        )
      }

      await this.writeTeacherAudit(
        id,
        'update',
        priorState,
        {
          display_name: updatedProfile.display_name,
          status: updatedProfile.status,
          is_active: updatedProfile.is_active,
        },
        options.actorId,
      )

      return {
        id: existing.id,
        email: existing.email,
        name: updatedProfile.display_name || existing.email,
        role: 'teacher',
        status: (updatedProfile.status || 'active') as 'active' | 'disabled' | 'pending_approval',
        createdAt: existing.created_at,
        updatedAt: updatedProfile.updated_at || existing.updated_at,
        lastLoginAt: null,
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error updating teacher: ${err instanceof Error ? err.message : String(err)}`,
        'UPDATE_TEACHER_ERROR',
        err as any
      )
    }
  }

  async activateTeacher(id: string, options: TeacherWriteOptions = {}): Promise<AdminUser> {
    return this.setTeacherLifecycle(id, true, options)
  }

  async deactivateTeacher(id: string, options: TeacherWriteOptions = {}): Promise<AdminUser> {
    return this.setTeacherLifecycle(id, false, options)
  }

  async fetchTeacherAssignedClasses(teacherId: string): Promise<TeacherAssignedClass[]> {
    try {
      const supabase = getSupabaseClient()
      const { data: assignments, error: assignmentError } = await supabase
        .from('teacher_class_assignment')
        .select('class_id')
        .eq('teacher_id', teacherId)

      if (assignmentError) {
        throw new AdminServiceError(
          `Failed to fetch teacher assignments: ${assignmentError.message}`,
          'FETCH_TEACHER_CLASSES_ERROR',
          assignmentError as any
        )
      }

      const classIds = [...new Set((assignments || []).map((row: any) => row.class_id))]
      if (classIds.length === 0) return []

      const { data: classes, error: classError } = await supabase
        .from('classes')
        .select('id, class_name, is_active')
        .in('id', classIds)
        .order('class_name', { ascending: true })

      if (classError) {
        throw new AdminServiceError(
          `Failed to fetch teacher classes: ${classError.message}`,
          'FETCH_TEACHER_CLASSES_ERROR',
          classError as any
        )
      }

      return (classes || []).map((row: any) => ({
        id: row.id,
        name: row.class_name,
        isActive: row.is_active ?? true,
      }))
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching teacher classes: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_TEACHER_CLASSES_ERROR',
        err as any
      )
    }
  }

  private async setTeacherLifecycle(
    id: string,
    isActive: boolean,
    options: TeacherWriteOptions = {},
  ): Promise<AdminUser> {
    const supabase = getSupabaseClient()
    const action = isActive ? 'activate' : 'deactivate'

    try {
      const { data: existing, error: existingError } = await supabase
        .from('user_roles')
        .select(`
          id,
          email,
          role,
          created_at,
          updated_at,
          teacher_profiles (
            display_name,
            status,
            is_active,
            deactivated_at,
            updated_at
          )
        `)
        .eq('id', id)
        .eq('role', 'teacher')
        .single()

      if (existingError || !existing) {
        throw new AdminServiceError(
          `Teacher not found: ${existingError?.message || id}`,
          `${action.toUpperCase()}_TEACHER_ERROR`,
          existingError as any
        )
      }

      const priorState = {
        display_name: existing.teacher_profiles?.[0]?.display_name || existing.email,
        status: existing.teacher_profiles?.[0]?.status || 'active',
        is_active: existing.teacher_profiles?.[0]?.is_active ?? true,
        deactivated_at: existing.teacher_profiles?.[0]?.deactivated_at ?? null,
      }

      const { error } = await supabase
        .from('teacher_profiles')
        .update({ is_active: isActive })
        .eq('user_id', id)

      if (error) {
        throw new AdminServiceError(
          `Failed to ${action} teacher: ${error.message}`,
          `${action.toUpperCase()}_TEACHER_ERROR`,
          error as any
        )
      }

      const { data: updatedProfile, error: updatedError } = await supabase
        .from('teacher_profiles')
        .select('*')
        .eq('user_id', id)
        .single()

      if (updatedError || !updatedProfile) {
        throw new AdminServiceError(
          `Failed to fetch updated teacher profile: ${updatedError?.message || id}`,
          `${action.toUpperCase()}_TEACHER_ERROR`,
          updatedError as any
        )
      }

      await this.writeTeacherAudit(
        id,
        action as 'activate' | 'deactivate',
        priorState,
        {
          display_name: updatedProfile.display_name,
          status: updatedProfile.status,
          is_active: updatedProfile.is_active,
          deactivated_at: updatedProfile.deactivated_at,
        },
        options.actorId,
      )

      return {
        id: existing.id,
        email: existing.email,
        name: updatedProfile.display_name || existing.email,
        role: 'teacher',
        status: (updatedProfile.status || 'active') as 'active' | 'disabled' | 'pending_approval',
        createdAt: existing.created_at,
        updatedAt: updatedProfile.updated_at || existing.updated_at,
        lastLoginAt: null,
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error updating teacher lifecycle: ${err instanceof Error ? err.message : String(err)}`,
        `${action.toUpperCase()}_TEACHER_ERROR`,
        err as any
      )
    }
  }

  /**
   * Fetch teacher class restrictions for a user.
   * Non-teacher users return an empty array.
   */
  async fetchUserClassRestrictions(userId: string, role?: AccessControlRole): Promise<string[]> {
    if (role && role !== 'teacher') return []

    const supabase = getSupabaseClient()
    let resolvedRole = role
    if (!resolvedRole) {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('id', userId)
        .single()

      if (error) {
        throw new AdminServiceError(
          `Failed to fetch user role for class restrictions: ${error.message}`,
          'FETCH_USER_CLASS_SCOPE_ERROR',
          error as any
        )
      }

      resolvedRole = data.role
    }

    if (resolvedRole !== 'teacher') return []
    return this.fetchTeacherClassIdsInternal(userId)
  }

  /**
   * Update user role set and class restrictions in one operation.
   */
  async updateUserAccessControl(
    userId: string,
    roles: AccessControlRole[],
    classIds: string[] = [],
    options: AccessControlWriteOptions = {},
  ): Promise<AccessControlSummary> {
    const supabase = getSupabaseClient()
    const normalizedRoles = this.normalizeAccessRoles(roles)
    const winner = (resolveWinningRole(normalizedRoles as ResolverRole[]) || 'student') as AccessControlRole

    const { data: existingUser, error: existingError } = await supabase
      .from('user_roles')
      .select('id, email, role')
      .eq('id', userId)
      .single()

    if (existingError || !existingUser) {
      throw new AdminServiceError(
        `User not found for access-control update: ${existingError?.message || userId}`,
        'UPDATE_USER_ACCESS_ERROR',
        existingError as any
      )
    }

    const beforeRoles = await this.loadRoleAssignments(userId, existingUser.role as AccessControlRole)
    const beforeClassIds = await this.fetchTeacherClassIdsInternal(userId)
    const beforeSummary = this.buildAccessControlSummary(beforeRoles, beforeClassIds)

    const { error: updateRoleError } = await supabase
      .from('user_roles')
      .update({ role: winner })
      .eq('id', userId)

    if (updateRoleError) {
      throw new AdminServiceError(
        `Failed to update primary role: ${updateRoleError.message}`,
        'UPDATE_USER_ACCESS_ERROR',
        updateRoleError as any
      )
    }

    await this.saveRoleAssignments(userId, normalizedRoles)

    const nextClassIds = normalizedRoles.includes('teacher') ? this.dedupeClassIds(classIds) : []
    await this.saveTeacherClassIdsInternal(userId, nextClassIds)

    const afterSummary = this.buildAccessControlSummary(normalizedRoles, nextClassIds)
    const actorId = options.actorId || (await this.getCurrentAuthUserId()) || undefined

    await this.writePermissionMutationAudit(
      userId,
      options.auditAction || 'single_update',
      {
        roles: beforeSummary.roles,
        winningRole: beforeSummary.winningRole,
        classIds: beforeSummary.readClassIds,
      },
      {
        roles: afterSummary.roles,
        winningRole: afterSummary.winningRole,
        classIds: afterSummary.readClassIds,
      },
      options.metadata || {},
      actorId,
    )

    return afterSummary
  }

  /**
   * Preview impact for a bulk permission update.
   */
  async previewBulkPermissionUpdate(
    userIds: string[],
    roles: AccessControlRole[],
  ): Promise<BulkPermissionPreviewEntry[]> {
    const normalizedRoles = this.normalizeAccessRoles(roles)
    if (userIds.length === 0) return []

    const supabase = getSupabaseClient()
    const { data: users, error } = await supabase
      .from('user_roles')
      .select('id, email, role')
      .in('id', userIds)

    if (error) {
      throw new AdminServiceError(
        `Failed to fetch users for bulk preview: ${error.message}`,
        'BULK_PERMISSION_PREVIEW_ERROR',
        error as any
      )
    }

    const entries: BulkPermissionPreviewEntry[] = []
    for (const row of users || []) {
      const beforeRoles = await this.loadRoleAssignments(row.id, row.role as AccessControlRole)
      const beforeClassIds = await this.fetchTeacherClassIdsInternal(row.id)
      const beforeSummary = this.buildAccessControlSummary(beforeRoles, beforeClassIds)
      const afterClassIds = normalizedRoles.includes('teacher') ? beforeClassIds : []
      const afterSummary = this.buildAccessControlSummary(normalizedRoles, afterClassIds)

      entries.push({
        userId: row.id,
        email: row.email,
        before: beforeSummary,
        after: afterSummary,
      })
    }

    return entries.sort((a, b) => a.email.localeCompare(b.email))
  }

  /**
   * Apply the same role set to a list of users.
   */
  async applyBulkPermissionUpdate(
    userIds: string[],
    roles: AccessControlRole[],
    options: AccessControlWriteOptions = {},
  ): Promise<BulkPermissionApplyResult[]> {
    const normalizedRoles = this.normalizeAccessRoles(roles)
    if (userIds.length === 0) return []

    const supabase = getSupabaseClient()
    const { data: users, error } = await supabase
      .from('user_roles')
      .select('id, email, role')
      .in('id', userIds)

    if (error) {
      throw new AdminServiceError(
        `Failed to fetch users for bulk update: ${error.message}`,
        'BULK_PERMISSION_APPLY_ERROR',
        error as any
      )
    }

    const results: BulkPermissionApplyResult[] = []
    for (const row of users || []) {
      try {
        const existingClassIds = await this.fetchTeacherClassIdsInternal(row.id)
        const nextClassIds = normalizedRoles.includes('teacher') ? existingClassIds : []
        await this.updateUserAccessControl(
          row.id,
          normalizedRoles,
          nextClassIds,
          {
            actorId: options.actorId,
            auditAction: 'bulk_update',
            metadata: {
              ...options.metadata,
              bulkSize: userIds.length,
            },
          },
        )

        results.push({
          userId: row.id,
          email: row.email,
          success: true,
        })
      } catch (err) {
        results.push({
          userId: row.id,
          email: row.email,
          success: false,
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return results
  }

  /**
   * Fetch permission mutation and authorization decision logs.
   */
  async fetchAccessControlLogs(options: FetchAccessControlLogOptions = {}): Promise<AccessControlLogEntry[]> {
    const supabase = getSupabaseClient()
    const limit = options.limit || 50

    let mutationQuery = supabase
      .from('permission_mutation_audit_log')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(limit)

    if (options.targetUserId) mutationQuery = mutationQuery.eq('target_user_id', options.targetUserId)
    if (options.action) mutationQuery = mutationQuery.eq('action', options.action)
    if (options.from) mutationQuery = mutationQuery.gte('changed_at', options.from)
    if (options.to) mutationQuery = mutationQuery.lte('changed_at', options.to)

    const { data: mutationRows, error: mutationError } = await mutationQuery
    if (mutationError && !this.isMissingRelationError(mutationError)) {
      throw new AdminServiceError(
        `Failed to fetch permission mutation logs: ${mutationError.message}`,
        'FETCH_ACCESS_CONTROL_LOGS_ERROR',
        mutationError as any
      )
    }

    let decisionQuery = supabase
      .from('authorization_decision_trace')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (options.action) decisionQuery = decisionQuery.eq('action', options.action)
    if (options.from) decisionQuery = decisionQuery.gte('created_at', options.from)
    if (options.to) decisionQuery = decisionQuery.lte('created_at', options.to)

    const { data: decisionRows, error: decisionError } = await decisionQuery
    if (decisionError && !this.isMissingRelationError(decisionError)) {
      throw new AdminServiceError(
        `Failed to fetch authorization decision logs: ${decisionError.message}`,
        'FETCH_ACCESS_CONTROL_LOGS_ERROR',
        decisionError as any
      )
    }

    const mutationEntries: AccessControlLogEntry[] = (mutationRows || []).map((row: any) => ({
      id: row.id,
      type: 'mutation',
      action: row.action,
      actorId: row.actor_id || null,
      targetUserId: row.target_user_id || null,
      metadata: (row.metadata || {}) as Record<string, unknown>,
      beforeState: (row.before_state || {}) as Record<string, unknown>,
      afterState: (row.after_state || {}) as Record<string, unknown>,
      createdAt: row.changed_at,
    }))

    const decisionEntries: AccessControlLogEntry[] = (decisionRows || []).map((row: any) => ({
      id: row.id,
      type: 'decision',
      action: row.action,
      actorId: row.actor_id || null,
      targetUserId: ((row.metadata || {}) as Record<string, unknown>).targetUserId as string || null,
      winningRole: (row.winning_role || null) as AccessControlRole | null,
      policyVersion: row.policy_version || null,
      metadata: (row.metadata || {}) as Record<string, unknown>,
      reason: row.reason || null,
      createdAt: row.created_at,
    }))

    return [...mutationEntries, ...decisionEntries]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit)
  }

  /**
   * Fetch all users with optional filtering
   */
  async fetchUsers(role?: string): Promise<AdminUser[]> {
    try {
      const supabase = getSupabaseClient()

      let query = supabase
        .from('user_roles')
        .select('*')
        .order('email', { ascending: true })

      if (role) {
        query = query.eq('role', role)
      }

      const { data, error } = await query

      if (error) {
        throw new AdminServiceError(
          `Failed to fetch users: ${error.message}`,
          'FETCH_USERS_ERROR',
          error as any
        )
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        email: row.email,
        name: row.display_name || row.name || row.email,
        role: row.role,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastLoginAt: row.last_login_at,
      }))
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching users: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_USERS_ERROR',
        err as any
      )
    }
  }

  /**
   * Create user
   */
  async createUser(
    email: string,
    name: string,
    role: string,
    status: string = 'pending_approval'
  ): Promise<AdminUser> {
    try {
      const supabase = getSupabaseClient()
      const userId = crypto.randomUUID()

      const { data, error } = await supabase.rpc('admin_create_user_role', {
        target_user_id: userId,
        target_email: email,
        target_role: role,
      })

      if (error) {
        throw new AdminServiceError(
          `Failed to create user: ${error.message}`,
          'CREATE_USER_ERROR',
          error as any
        )
      }

      return {
        id: data.id,
        email: data.email,
        name: name, // Use the provided name parameter since it's not in user_roles table
        role: data.role,
        status: status as 'active' | 'disabled' | 'pending_approval', // Use the provided status parameter since it's not in user_roles table
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        lastLoginAt: data.last_login_at,
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error creating user: ${err instanceof Error ? err.message : String(err)}`,
        'CREATE_USER_ERROR',
        err as any
      )
    }
  }

  /**
   * Update user
   */
  async updateUser(
    id: string,
    updates: Partial<AdminUser>
  ): Promise<AdminUser> {
    try {
      const supabase = getSupabaseClient()
      const nextRole = updates.role ?? 'parent'
      const { data, error } = await supabase.rpc('admin_update_user_role', {
        target_user_id: id,
        target_role: nextRole,
      })

      if (error) {
        throw new AdminServiceError(
          `Failed to update user: ${error.message}`,
          'UPDATE_USER_ERROR',
          error as any
        )
      }

      return {
        id: data.id,
        email: data.email,
        name: updates.name || '', // Use updates parameter since it's not in user_roles table
        role: data.role,
        status: updates.status || 'pending_approval', // Use updates parameter since it's not in user_roles table
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        lastLoginAt: data.last_login_at,
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error updating user: ${err instanceof Error ? err.message : String(err)}`,
        'UPDATE_USER_ERROR',
        err as any
      )
    }
  }

  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<void> {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase.rpc('admin_delete_user_role', {
        target_user_id: id,
      })

      if (error) {
        throw new AdminServiceError(
          `Failed to delete user: ${error.message}`,
          'DELETE_USER_ERROR',
          error as any
        )
      }

      if (!data) {
        throw new AdminServiceError(
          `Failed to delete user: User role not found for id ${id}`,
          'DELETE_USER_ERROR'
        )
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error deleting user: ${err instanceof Error ? err.message : String(err)}`,
        'DELETE_USER_ERROR',
        err as any
      )
    }
  }

  /**
   * ============ RELATIONSHIP OPERATIONS ============
   */

  /**
   * Create parent-student relationship
   */
  async linkParentToStudent(
    parentId: string,
    studentId: string,
    relationship?: string
  ): Promise<ParentStudentRelationship> {
    try {
      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .from('parent_student_relationships')
        .insert({
          parent_id: parentId,
          student_id: studentId,
          relationship: relationship || null,
        })
        .select()
        .single()

      if (error) {
        throw new AdminServiceError(
          `Failed to create relationship: ${error.message}`,
          'CREATE_RELATIONSHIP_ERROR',
          error as any
        )
      }

      return {
        id: data.id,
        parentId: data.parent_id,
        studentId: data.student_id,
        relationship: data.relationship,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error creating relationship: ${err instanceof Error ? err.message : String(err)}`,
        'CREATE_RELATIONSHIP_ERROR',
        err as any
      )
    }
  }

  /**
   * Delete parent-student relationship
   */
  async unlinkParentFromStudent(
    parentId: string,
    studentId: string
  ): Promise<void> {
    try {
      const supabase = getSupabaseClient()

      const { error } = await supabase
        .from('parent_student_relationships')
        .delete()
        .eq('parent_id', parentId)
        .eq('student_id', studentId)

      if (error) {
        throw new AdminServiceError(
          `Failed to delete relationship: ${error.message}`,
          'DELETE_RELATIONSHIP_ERROR',
          error as any
        )
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error deleting relationship: ${err instanceof Error ? err.message : String(err)}`,
        'DELETE_RELATIONSHIP_ERROR',
        err as any
      )
    }
  }

  /**
   * Get parent's students
   */
  async getParentStudents(parentId: string): Promise<AdminUser[]> {
    try {
      const supabase = getSupabaseClient()

      const { data: relationships, error: relError } = await supabase
        .from('parent_student_relationships')
        .select('student_id')
        .eq('parent_id', parentId)

      if (relError) {
        throw new AdminServiceError(
          `Failed to fetch relationships: ${relError.message}`,
          'FETCH_RELATIONSHIPS_ERROR',
          relError as any
        )
      }

      if (!relationships || relationships.length === 0) {
        return []
      }

      const studentIds = relationships.map((r: any) => r.student_id)

      const { data: students, error: studError } = await supabase
        .from('user_roles')
        .select('*')
        .in('id', studentIds)

      if (studError) {
        throw new AdminServiceError(
          `Failed to fetch students: ${studError.message}`,
          'FETCH_STUDENTS_ERROR',
          studError as any
        )
      }

      return (students || []).map((row: any) => ({
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastLoginAt: row.last_login_at,
      }))
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching parent's students: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_PARENT_STUDENTS_ERROR',
        err as any
      )
    }
  }

  /**
   * Get all parent-student relationships with performance optimization
   */
  async getParentStudentRelationships(): Promise<Array<{ parentId: string; studentId: string }>> {
    try {
      const supabase = getSupabaseClient()
      const startTime = Date.now()

      const { data: relationships, error } = await supabase
        .from('parent_student_relationships')
        .select('parent_id, student_id')

      if (error) {
        throw new AdminServiceError(
          `Failed to fetch relationships: ${error.message}`,
          'FETCH_RELATIONSHIPS_ERROR',
          error as any
        )
      }

      const elapsedTime = Date.now() - startTime
      if (elapsedTime > 500) {
        console.warn(`Performance warning: getParentStudentRelationships took ${elapsedTime}ms`)
      }

      return (relationships || []).map((row: any) => ({
        parentId: row.parent_id,
        studentId: row.student_id,
      }))
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching relationships: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_RELATIONSHIPS_ERROR',
        err as any
      )
    }
  }
}

/**
 * Singleton instance of admin service
 */
export const adminService = new AdminService()

export default adminService
