/* eslint-disable @typescript-eslint/no-explicit-any */
import { adminApi, adminRpc } from '@/services/backendApi'
import type {
  AccessControlLogEntry,
  AccessControlRole,
  AdminArticle,
  AdminNewsletter,
  AdminRecycleBinArticle,
  AdminUser,
  ArticleCategory,
  ArticleRevision,
  ArticleTag,
  BulkPermissionApplyResult,
  BulkPermissionPreviewEntry,
  Class,
  Family,
  NewsletterDeliveryBatchSummary,
  NewsletterDeliveryRecipientSummary,
  NewsletterFilterOptions,
  NewsletterPublishAudienceSelection,
  NewsletterPublishReadiness,
  ParentStudentRelationship,
} from '@/types/admin'
import type { DeliveryAudienceSelection } from '@/types/emailDelivery'

export class AdminServiceError extends Error {
  constructor(
    message: string,
    public code: string = 'ADMIN_SERVICE_ERROR',
    public originalError?: unknown,
  ) {
    super(message)
    this.name = 'AdminServiceError'
  }
}

export interface TeacherAssignedClass {
  id: string
  name: string
  isActive: boolean
}

interface AdminServiceCompat {
  fetchNewsletters(filters?: NewsletterFilterOptions): Promise<AdminNewsletter[]>
  fetchNewsletter(id: string): Promise<AdminNewsletter>
  fetchNewsletterByWeek(weekNumber: string): Promise<AdminNewsletter>
  fetchNewsletterTemplates(): Promise<AdminNewsletter[]>
  createNewsletter(...args: any[]): Promise<AdminNewsletter>
  createNewsletterFromTemplate(...args: any[]): Promise<AdminNewsletter>
  createTemplateFromNewsletter(...args: any[]): Promise<AdminNewsletter>
  updateNewsletter(...args: any[]): Promise<AdminNewsletter>
  deleteNewsletter(id: string): Promise<void>
  archiveNewsletter(id: string): Promise<AdminNewsletter>
  publishNewsletter(id: string): Promise<AdminNewsletter>
  publishNewsletterWithDelivery(newsletterId: string, audience?: NewsletterPublishAudienceSelection): Promise<AdminNewsletter>
  getNewsletterPublishReadiness(newsletterId: string, audience?: NewsletterPublishAudienceSelection): Promise<NewsletterPublishReadiness>
  fetchNewsletterDeliveryBatches(newsletterId: string): Promise<NewsletterDeliveryBatchSummary[]>
  createNewsletterResendBatch(parentBatchId: string, audience?: NewsletterPublishAudienceSelection): Promise<NewsletterDeliveryBatchSummary>
  fetchNewsletterDeliveryRecipients(batchId: string): Promise<NewsletterDeliveryRecipientSummary[]>

  fetchAllArticles(): Promise<AdminArticle[]>
  fetchArticle(id: string): Promise<AdminArticle>
  fetchArticlesByNewsletter(weekNumber: string): Promise<AdminArticle[]>
  fetchArticlesByNewsletterId(newsletterId: string): Promise<AdminArticle[]>
  getAvailableArticlesByNewsletterId(newsletterId: string): Promise<AdminArticle[]>
  createArticleForNewsletter(...args: any[]): Promise<AdminArticle>
  updateArticle(...args: any[]): Promise<AdminArticle>
  deleteArticle(id: string): Promise<void>
  fetchDeletedArticles(): Promise<AdminRecycleBinArticle[]>
  restoreDeletedArticle(id: string): Promise<AdminArticle>
  purgeDeletedArticle(id: string): Promise<void>
  fetchArticleVersionHistory(articleId: string): Promise<ArticleRevision[]>
  restoreArticleVersion(articleId: string, revisionId: string): Promise<AdminArticle>
  addArticleToNewsletter(...args: any[]): Promise<any>
  addArticleToNewsletterById(...args: any[]): Promise<any>
  removeArticleFromNewsletter(...args: any[]): Promise<any>
  removeArticleFromNewsletterById(...args: any[]): Promise<any>
  reorderArticlesInNewsletterById(...args: any[]): Promise<any>
  updateArticleTargetingInNewsletterById(...args: any[]): Promise<any>
  fetchArticleNewsletterMemberships(...args: any[]): Promise<Record<string, Array<{ newsletterId: string; label: string; isTemplate: boolean }>>>
  fetchArticleCategories(...args: any[]): Promise<ArticleCategory[]>
  fetchArticleTags(...args: any[]): Promise<ArticleTag[]>
  fetchArticleTaxonomyAssignments(...args: any[]): Promise<Record<string, { categoryIds: string[]; tagIds: string[] }>>
  updateArticleTaxonomyAssignments(...args: any[]): Promise<void>
  createArticleCategory(...args: any[]): Promise<ArticleCategory>
  updateArticleCategory(...args: any[]): Promise<ArticleCategory>
  activateArticleCategory(id: string): Promise<ArticleCategory>
  deactivateArticleCategory(id: string): Promise<ArticleCategory>
  createArticleTag(...args: any[]): Promise<ArticleTag>
  updateArticleTag(...args: any[]): Promise<ArticleTag>
  activateArticleTag(id: string): Promise<ArticleTag>
  deactivateArticleTag(id: string): Promise<ArticleTag>

  fetchClasses(...args: any[]): Promise<Class[]>
  createClass(...args: any[]): Promise<Class>
  updateClass(...args: any[]): Promise<Class>
  activateClass(id: string): Promise<Class>
  deactivateClass(id: string): Promise<Class>
  fetchFamilies(...args: any[]): Promise<Family[]>
  createFamily(...args: any[]): Promise<Family>
  updateFamily(...args: any[]): Promise<Family>
  activateFamily(id: string): Promise<Family>
  deactivateFamily(id: string): Promise<Family>
  fetchStudents(...args: any[]): Promise<any[]>
  createStudent(...args: any[]): Promise<any>
  updateStudent(...args: any[]): Promise<any>
  activateStudent(id: string): Promise<any>
  deactivateStudent(id: string): Promise<any>
  fetchParents(...args: any[]): Promise<any[]>
  createParent(...args: any[]): Promise<any>
  updateParent(...args: any[]): Promise<any>
  deleteParent(id: string): Promise<void>
  fetchTeachers(...args: any[]): Promise<any[]>
  createTeacher(...args: any[]): Promise<any>
  updateTeacher(...args: any[]): Promise<any>
  activateTeacher(id: string): Promise<any>
  deactivateTeacher(id: string): Promise<any>
  fetchTeacherAssignedClasses(teacherId: string): Promise<TeacherAssignedClass[]>
  getAvailableParents(...args: any[]): Promise<AdminUser[]>
  getAvailableStudents(...args: any[]): Promise<any[]>
  getFamilyMembers(familyId: string): Promise<any>
  addParentToFamily(...args: any[]): Promise<any>
  removeParentFromFamily(...args: any[]): Promise<any>
  addStudentToFamily(...args: any[]): Promise<any>
  removeStudentFromFamily(...args: any[]): Promise<any>
  addStudentToClassEnrollment(...args: any[]): Promise<any>
  fetchParentStudentRelationships(parentId?: string): Promise<ParentStudentRelationship[]>
  linkParentToStudent(...args: any[]): Promise<ParentStudentRelationship>
  unlinkParentFromStudent(...args: any[]): Promise<void>
  updateParentRelationship(...args: any[]): Promise<ParentStudentRelationship>

  fetchUsers(role?: string): Promise<AdminUser[]>
  createUser(email: string, name: string, role: string, status?: string): Promise<AdminUser>
  updateUser(id: string, updates: Partial<AdminUser>): Promise<AdminUser>
  deleteUser(id: string): Promise<void>
  updateUserAccessControl(
    userId: string,
    roles: AccessControlRole[],
    classIds?: string[],
    options?: any,
  ): Promise<any>
  fetchUserClassRestrictions(userId: string, role?: AccessControlRole): Promise<string[]>
  previewBulkPermissionUpdate(userIds: string[], roles: AccessControlRole[]): Promise<BulkPermissionPreviewEntry[]>
  applyBulkPermissionUpdate(userIds: string[], roles: AccessControlRole[], options?: any): Promise<BulkPermissionApplyResult[]>
  fetchAccessControlLogs(options?: any): Promise<AccessControlLogEntry[]>

  [method: string]: (...args: any[]) => Promise<any>
}

const explicitMethods: Partial<AdminServiceCompat> = {
  async getNewsletterPublishReadiness(newsletterId: string, audience?: DeliveryAudienceSelection) {
    return adminApi.getPublishReadiness(newsletterId, audience) as Promise<NewsletterPublishReadiness>
  },

  async publishNewsletterWithDelivery(newsletterId: string, audience?: DeliveryAudienceSelection) {
    const result = await adminApi.publishAndDeliver({ newsletterId, audience: audience ?? { mode: 'all' } })
    return result.newsletter as AdminNewsletter
  },

  async fetchNewsletterDeliveryBatches(newsletterId: string) {
    return adminApi.listDeliveryBatches(newsletterId) as Promise<NewsletterDeliveryBatchSummary[]>
  },

  async createNewsletterResendBatch(parentBatchId: string, audience?: DeliveryAudienceSelection) {
    return adminApi.createResendBatch({ parentBatchId, audience }) as Promise<NewsletterDeliveryBatchSummary>
  },

  async fetchNewsletterDeliveryRecipients(batchId: string) {
    return adminApi.listDeliveryRecipients(batchId) as Promise<NewsletterDeliveryRecipientSummary[]>
  },
}

export const adminService = new Proxy(explicitMethods, {
  get(target, prop) {
    if (typeof prop !== 'string') {
      return undefined
    }
    if (prop in target) {
      return target[prop]
    }
    return (...args: any[]) => adminRpc('admin', prop, args)
  },
}) as AdminServiceCompat

export default adminService
