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

import { getSupabaseServiceClient } from '@/lib/supabase'
import type {
  AdminNewsletter,
  AdminArticle,
  Class,
  Family,
  AdminUser,
  ParentStudentRelationship,
  NewsletterFilterOptions,
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

/**
 * Admin Service
 * Provides methods for admin dashboard operations
 */
class AdminService {
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
      const supabase = getSupabaseServiceClient()

      let query = supabase
        .from('newsletter_weeks')
        .select('*, articles(count)')
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
          `week_number.ilike.%${filters.searchTerm}%`
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

      return (data || []).map((row: any) => ({
        id: row.week_number,
        weekNumber: row.week_number,
        releaseDate: row.release_date,
        status: row.is_published ? 'published' : 'draft',
        articleCount: row.articles?.[0]?.count || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        publishedAt: row.published_at,
        isPublished: row.is_published,
      }))
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error fetching newsletters: ${err instanceof Error ? err.message : String(err)}`,
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
      const supabase = getSupabaseServiceClient()

      const { data, error } = await supabase
        .from('newsletter_weeks')
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
        id: data.week_number,
        weekNumber: data.week_number,
        releaseDate: data.release_date,
        status: data.is_published ? 'published' : 'draft',
        articleCount: data.article_count || 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        publishedAt: data.published_at,
        isPublished: data.is_published,
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
      const supabase = getSupabaseServiceClient()

      const { data, error } = await supabase
        .from('newsletter_weeks')
        .select('*, articles(count)')
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
        id: data.week_number,
        weekNumber: data.week_number,
        releaseDate: data.release_date,
        status: data.is_published ? 'published' : 'draft',
        articleCount: data.articles?.[0]?.count || 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        publishedAt: data.published_at,
        isPublished: data.is_published,
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
    weekNumber: string,
    releaseDate: string
  ): Promise<AdminNewsletter> {
    try {
      const supabase = getSupabaseServiceClient()

      const { data, error } = await supabase
        .from('newsletter_weeks')
        .insert({
          week_number: weekNumber,
          release_date: releaseDate,
          is_published: false,
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

      return {
        id: data.week_number, // Use week_number as ID since it's the primary key
        weekNumber: data.week_number,
        releaseDate: data.release_date,
        status: data.is_published ? 'published' : 'draft',
        articleCount: data.article_count || 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        publishedAt: data.published_at,
        isPublished: data.is_published,
      }
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

  /**
   * Publish newsletter (draft → published)
   */
  async publishNewsletter(id: string): Promise<AdminNewsletter> {
    try {
      const supabase = getSupabaseServiceClient()

      // Check that newsletter has at least one article
      const { data: articles, error: articleError } = await supabase
        .from('articles')
        .select('id')
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
        .from('newsletter_weeks')
        .update({
          is_published: true,
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
        id: data.week_number,
        weekNumber: data.week_number,
        releaseDate: data.release_date,
        status: data.is_published ? 'published' : 'draft',
        articleCount: data.article_count || 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        publishedAt: data.published_at,
        isPublished: data.is_published,
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
      const supabase = getSupabaseServiceClient()

      const { data, error } = await supabase
        .from('newsletter_weeks')
        .update({ is_published: false })
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
        id: data.week_number,
        weekNumber: data.week_number,
        releaseDate: data.release_date,
        status: data.is_published ? 'published' : 'draft',
        articleCount: data.article_count || 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        publishedAt: data.published_at,
        isPublished: data.is_published,
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
      const supabase = getSupabaseServiceClient()

      const { error } = await supabase
        .from('newsletter_weeks')
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
   * Fetch articles by newsletter
   */
  async fetchArticlesByNewsletter(
    weekNumber: string
  ): Promise<AdminArticle[]> {
    try {
      const supabase = getSupabaseServiceClient()

      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('week_number', weekNumber)
        .order('article_order', { ascending: true })

      if (error) {
        throw new AdminServiceError(
          `Failed to fetch articles: ${error.message}`,
          'FETCH_ARTICLES_ERROR',
          error as any
        )
      }

      return (data || []).map((row: any) => ({
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
        `Error fetching articles: ${err instanceof Error ? err.message : String(err)}`,
        'FETCH_ARTICLES_ERROR',
        err as any
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
      const supabase = getSupabaseServiceClient()

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
        ...updates,
        last_edited_by: userId,
        edited_at: now,
        updated_at: now,
      }

      // Map AdminArticle fields to database fields
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
      const supabase = getSupabaseServiceClient()

      const { error } = await supabase
        .from('articles')
        .delete()
        .eq('id', id)

      if (error) {
        throw new AdminServiceError(
          `Failed to delete article: ${error.message}`,
          'DELETE_ARTICLE_ERROR',
          error as any
        )
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error deleting article: ${err instanceof Error ? err.message : String(err)}`,
        'DELETE_ARTICLE_ERROR',
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
  async fetchClasses(): Promise<Class[]> {
    try {
      const supabase = getSupabaseServiceClient()

      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('class_name', { ascending: true })

      if (error) {
        throw new AdminServiceError(
          `Failed to fetch classes: ${error.message}`,
          'FETCH_CLASSES_ERROR',
          error as any
        )
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        name: row.class_name,
        description: '', // Not in DB
        studentIds: [], // Fetched separately if needed
        createdAt: row.created_at,
        updatedAt: row.created_at, // Not in DB
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
    studentIds?: string[]
  ): Promise<Class> {
    try {
      const supabase = getSupabaseServiceClient()

      // ID strategy: Use name as ID if short enough, otherwise generate short ID
      // For now, let's use a simplified approach: use name as ID if < 10 chars
      const id = name.length <= 10 ? name : name.substring(0, 10)

      const { data, error } = await supabase
        .from('classes')
        .insert({
          id,
          class_name: name,
          class_grade_year: 1, // Default to 1 as it's required
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

      return {
        id: data.id,
        name: data.class_name,
        description: description,
        studentIds: studentIds || [],
        createdAt: data.created_at,
        updatedAt: data.created_at,
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
      description?: string,
      studentIds?: string[]
    }
  ): Promise<Class> {
    try {
      const supabase = getSupabaseServiceClient()

      const updatePayload: any = {}
      if (updates.name !== undefined) updatePayload.class_name = updates.name
      // description is not in DB
      // studentIds handled via separate table (student_class_enrollment) - skipping for now to fix crash

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

      return {
        id: data.id,
        name: data.class_name,
        description: updates.description,
        studentIds: updates.studentIds || [],
        createdAt: data.created_at,
        updatedAt: data.created_at,
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
    try {
      const supabase = getSupabaseServiceClient()

      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', id)

      if (error) {
        throw new AdminServiceError(
          `Failed to delete class: ${error.message}`,
          'DELETE_CLASS_ERROR',
          error as any
        )
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error deleting class: ${err instanceof Error ? err.message : String(err)}`,
        'DELETE_CLASS_ERROR',
        err as any
      )
    }
  }

  /**
   * ============ FAMILY OPERATIONS ============
   */

  /**
   * Fetch all families
   */
  async fetchFamilies(): Promise<Family[]> {
    try {
      const supabase = getSupabaseServiceClient()

      const { data, error } = await supabase
        .from('families')
        .select('*')
        .order('family_code', { ascending: true })

      if (error) {
        throw new AdminServiceError(
          `Failed to fetch families: ${error.message}`,
          'FETCH_FAMILIES_ERROR',
          error as any
        )
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        name: row.family_code || '', // Use family_code as name since name column doesn't exist
        description: '', // Not in DB
        relatedTopics: [], // Not in DB
        createdAt: row.created_at,
        updatedAt: row.created_at, // Not in DB, use created_at
      }))
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
    _description?: string,
    _relatedTopics?: string[]
  ): Promise<Family> {
    try {
      const supabase = getSupabaseServiceClient()

      // Use name as family_code since family_code is the only text field that exists
      const { data, error } = await supabase
        .from('families')
        .insert({
          family_code: name, // Map name to family_code
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

      return {
        id: data.id,
        name: data.family_code,
        description: '', // description parameter is not used in DB
        relatedTopics: [], // relatedTopics parameter is not used in DB
        createdAt: data.created_at,
        updatedAt: data.created_at,
      }
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
      description?: string,
      relatedTopics?: string[]
    }
  ): Promise<Family> {
    try {
      const supabase = getSupabaseServiceClient()

      const updatePayload: any = {}
      // Map name to family_code since family_code is the only text field that exists
      if (updates.name !== undefined) updatePayload.family_code = updates.name
      // description and relatedTopics are not stored in DB

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

      return {
        id: data.id,
        name: data.family_code,
        description: updates.description || '', // Not in DB
        relatedTopics: updates.relatedTopics || [], // Not in DB
        createdAt: data.created_at,
        updatedAt: data.created_at,
      }
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
    try {
      const supabase = getSupabaseServiceClient()

      const { error } = await supabase
        .from('families')
        .delete()
        .eq('id', id)

      if (error) {
        throw new AdminServiceError(
          `Failed to delete family: ${error.message}`,
          'DELETE_FAMILY_ERROR',
          error as any
        )
      }
    } catch (err) {
      if (err instanceof AdminServiceError) throw err
      throw new AdminServiceError(
        `Error deleting family: ${err instanceof Error ? err.message : String(err)}`,
        'DELETE_FAMILY_ERROR',
        err as any
      )
    }
  }

  /**
   * ============ USER OPERATIONS ============
   */

  /**
   * Fetch all users with optional filtering
   */
  async fetchUsers(role?: string): Promise<AdminUser[]> {
    try {
      const supabase = getSupabaseServiceClient()

      let query = supabase
        .from('users')
        .select('*')
        .order('name', { ascending: true })

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
      const supabase = getSupabaseServiceClient()

      const { data, error } = await supabase
        .from('users')
        .insert({
          email,
          name,
          role,
          status,
        })
        .select()
        .single()

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
        name: data.name,
        role: data.role,
        status: data.status,
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
      const supabase = getSupabaseServiceClient()

      const updatePayload: any = {
        ...updates,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single()

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
        name: data.name,
        role: data.role,
        status: data.status,
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
      const supabase = getSupabaseServiceClient()

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id)

      if (error) {
        throw new AdminServiceError(
          `Failed to delete user: ${error.message}`,
          'DELETE_USER_ERROR',
          error as any
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
      const supabase = getSupabaseServiceClient()

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
      const supabase = getSupabaseServiceClient()

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
      const supabase = getSupabaseServiceClient()

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
        .from('users')
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
}

/**
 * Singleton instance of admin service
 */
export const adminService = new AdminService()

export default adminService
