/**
 * Batch Import Service
 * Handles CSV batch import operations for users with all-or-nothing validation strategy.
 *
 * Features:
 * - Validates entire CSV file before any database writes
 * - All-or-nothing strategy: entire batch succeeds or fails atomically
 * - Email uniqueness validation against existing users
 * - Role validation against allowed roles
 * - Field presence and format validation
 * - Detailed error reporting with row numbers
 */

import { getSupabaseServiceClient } from '@/lib/supabase'

/**
 * CSV row structure expected from user import
 */
export interface CSVUserRow {
  email: string
  name: string
  role: 'admin' | 'teacher' | 'parent' | 'student'
  status?: 'active' | 'disabled' | 'pending_approval'
}

/**
 * Validation result for a single row
 */
export interface RowValidationResult {
  rowNumber: number
  isValid: boolean
  errors: string[]
  data?: CSVUserRow
}

/**
 * Result of batch import validation
 */
export interface BatchValidationResult {
  isValid: boolean
  totalRows: number
  validRows: number
  invalidRows: number
  rowResults: RowValidationResult[]
  errors: string[]
}

/**
 * Result of successful batch import
 */
export interface BatchImportSuccess {
  success: true
  importedCount: number
  totalCount: number
  details: {
    createdAt: string
    importedUserEmails: string[]
  }
}

/**
 * Result of failed batch import
 */
export interface BatchImportFailure {
  success: false
  reason: string
  validationErrors?: RowValidationResult[]
  details: {
    failedAt: string
    attemptedCount: number
  }
}

/**
 * Overall import result type
 */
export type BatchImportResult = BatchImportSuccess | BatchImportFailure

/**
 * Allowed roles for user imports
 */
const ALLOWED_ROLES = ['admin', 'teacher', 'parent', 'student'] as const

/**
 * Batch Import Service
 * Manages CSV import operations with atomic all-or-nothing semantics
 */
class BatchImportService {
  /**
   * Validate a single CSV row
   *
   * @param row - CSV row data
   * @param rowNumber - Row number in CSV (1-based, for error reporting)
   * @returns Validation result for the row
   */
  private validateRow(row: any, rowNumber: number): RowValidationResult {
    const errors: string[] = []

    // Validate email field
    if (!row.email || typeof row.email !== 'string') {
      errors.push('Email is required and must be a string')
    } else if (!this.isValidEmail(row.email)) {
      errors.push(`Invalid email format: ${row.email}`)
    }

    // Validate name field
    if (!row.name || typeof row.name !== 'string') {
      errors.push('Name is required and must be a string')
    } else if (row.name.trim().length === 0) {
      errors.push('Name cannot be empty or whitespace')
    }

    // Validate role field
    if (!row.role || typeof row.role !== 'string') {
      errors.push('Role is required and must be a string')
    } else if (!ALLOWED_ROLES.includes(row.role)) {
      errors.push(
        `Role must be one of: ${ALLOWED_ROLES.join(', ')}. Got: ${row.role}`
      )
    }

    // Validate status field (optional, but if present must be valid)
    if (row.status) {
      const validStatuses = ['active', 'disabled', 'pending_approval']
      if (!validStatuses.includes(row.status)) {
        errors.push(
          `Status must be one of: ${validStatuses.join(', ')}. Got: ${row.status}`
        )
      }
    }

    return {
      rowNumber,
      isValid: errors.length === 0,
      errors,
      data: errors.length === 0 ? this.normalizeRow(row) : undefined,
    }
  }

  /**
   * Check if email is in valid format
   *
   * @param email - Email to validate
   * @returns True if email is valid
   */
  private isValidEmail(email: string): boolean {
    // Simple email regex - matches most common email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Normalize row data (trim whitespace, set defaults)
   *
   * @param row - Raw row data
   * @returns Normalized row
   */
  private normalizeRow(row: any): CSVUserRow {
    return {
      email: (row.email as string).toLowerCase().trim(),
      name: (row.name as string).trim(),
      role: row.role as CSVUserRow['role'],
      status: (row.status || 'pending_approval') as CSVUserRow['status'],
    }
  }

  /**
   * Validate entire CSV data before import
   *
   * @param rows - Array of CSV rows
   * @returns Validation result for entire batch
   * @remarks
   * - Validates each row independently
   * - Checks for duplicate emails within the import
   * - Does NOT check against existing database (done in validateAgainstDatabase)
   */
  validateCSVFormat(rows: any[]): BatchValidationResult {
    const rowResults: RowValidationResult[] = []
    const seenEmails = new Set<string>()
    const errors: string[] = []

    // Validate each row
    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2 // 1-based, +1 for header
      const result = this.validateRow(rows[i], rowNumber)
      rowResults.push(result)

      // Check for duplicate emails within import
      if (result.isValid && result.data) {
        if (seenEmails.has(result.data.email)) {
          result.isValid = false
          result.errors.push(`Duplicate email in import: ${result.data.email}`)
        } else {
          seenEmails.add(result.data.email)
        }
      }
    }

    const validRows = rowResults.filter((r) => r.isValid).length
    const invalidRows = rowResults.filter((r) => !r.isValid).length

    if (invalidRows > 0) {
      errors.push(`${invalidRows} row(s) failed validation`)
    }

    return {
      isValid: invalidRows === 0,
      totalRows: rows.length,
      validRows,
      invalidRows,
      rowResults,
      errors,
    }
  }

  /**
   * Check CSV data against existing database records
   *
   * @param validation - Previous CSV format validation result
   * @returns Updated validation result including database checks
   * @remarks
   * - Checks if emails already exist in users table
   * - Returns same validation result if no database errors found
   * - Adds errors if emails conflict with existing users
   */
  async validateAgainstDatabase(
    validation: BatchValidationResult
  ): Promise<BatchValidationResult> {
    // If format validation already failed, skip database checks
    if (!validation.isValid) {
      return validation
    }

    try {
      const supabase = getSupabaseServiceClient()

      // Extract all emails from valid rows
      const validEmails = validation.rowResults
        .filter((r) => r.isValid && r.data)
        .map((r) => r.data!.email)

      if (validEmails.length === 0) {
        return validation
      }

      // Check if any emails already exist in database
      const { data: existingUsers, error } = await supabase
        .from('users')
        .select('email')
        .in('email', validEmails)

      if (error) {
        validation.isValid = false
        validation.errors.push(`Database check failed: ${error.message}`)
        return validation
      }

      // Mark rows with existing emails as invalid
      if (existingUsers && existingUsers.length > 0) {
        const existingEmails = new Set(existingUsers.map((u) => u.email))

        for (const result of validation.rowResults) {
          if (result.isValid && result.data) {
            if (existingEmails.has(result.data.email)) {
              result.isValid = false
              result.errors.push(
                `Email already exists in system: ${result.data.email}`
              )
            }
          }
        }

        // Recalculate validity
        const newValidCount = validation.rowResults.filter(
          (r) => r.isValid
        ).length
        const newInvalidCount = validation.totalRows - newValidCount

        if (newInvalidCount > 0) {
          validation.isValid = false
          validation.validRows = newValidCount
          validation.invalidRows = newInvalidCount
          validation.errors.push(`${newInvalidCount} email(s) already exist`)
        }
      }

      return validation
    } catch (err) {
      validation.isValid = false
      validation.errors.push(
        `Database validation error: ${err instanceof Error ? err.message : String(err)}`
      )
      return validation
    }
  }

  /**
   * Execute batch import (all-or-nothing strategy)
   *
   * @param validation - Validated batch data
   * @returns Import result (success or failure)
   * @remarks
   * - Only proceeds if validation.isValid === true
   * - Uses Supabase transaction semantics for atomicity
   * - If any insert fails, entire batch is rolled back
   */
  async executeBatchImport(
    validation: BatchValidationResult
  ): Promise<BatchImportResult> {
    // Fail if validation didn't pass
    if (!validation.isValid) {
      return {
        success: false,
        reason: 'Batch failed validation. See validationErrors for details.',
        validationErrors: validation.rowResults.filter((r) => !r.isValid),
        details: {
          failedAt: new Date().toISOString(),
          attemptedCount: validation.totalRows,
        },
      }
    }

    try {
      const supabase = getSupabaseServiceClient()

      // Extract valid rows for insertion
      const rowsToInsert = validation.rowResults
        .filter((r) => r.isValid && r.data)
        .map((r) => r.data!)

      if (rowsToInsert.length === 0) {
        return {
          success: false,
          reason: 'No valid rows to import',
          details: {
            failedAt: new Date().toISOString(),
            attemptedCount: 0,
          },
        }
      }

      // Prepare user records for insertion
      const usersToInsert = rowsToInsert.map((row) => ({
        email: row.email,
        name: row.name,
        role: row.role,
        status: row.status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))

      // Insert all users in a single batch
      // Supabase will enforce constraints (email uniqueness, etc.)
      const { data: insertedUsers, error } = await supabase
        .from('users')
        .insert(usersToInsert)
        .select('email')

      if (error) {
        // All-or-nothing: if any insert failed, entire batch fails
        return {
          success: false,
          reason: `Import failed: ${error.message}. No users were imported.`,
          details: {
            failedAt: new Date().toISOString(),
            attemptedCount: rowsToInsert.length,
          },
        }
      }

      if (!insertedUsers || insertedUsers.length === 0) {
        return {
          success: false,
          reason: 'Import completed but no users were created',
          details: {
            failedAt: new Date().toISOString(),
            attemptedCount: rowsToInsert.length,
          },
        }
      }

      return {
        success: true,
        importedCount: insertedUsers.length,
        totalCount: validation.totalRows,
        details: {
          createdAt: new Date().toISOString(),
          importedUserEmails: insertedUsers.map((u) => u.email),
        },
      }
    } catch (err) {
      return {
        success: false,
        reason: `Import error: ${err instanceof Error ? err.message : String(err)}. No users were imported.`,
        details: {
          failedAt: new Date().toISOString(),
          attemptedCount: validation.totalRows,
        },
      }
    }
  }

  /**
   * Full batch import pipeline: validate format → validate against DB → execute
   *
   * @param rows - CSV rows to import
   * @returns Final import result
   * @remarks
   * - Combines all three steps into single operation
   * - Validates format first (fast, no DB access)
   * - Then checks against database (slower)
   * - Only executes import if all validations pass
   */
  async importBatch(rows: any[]): Promise<BatchImportResult> {
    // Step 1: Validate CSV format
    let validation = this.validateCSVFormat(rows)

    if (!validation.isValid) {
      return {
        success: false,
        reason: 'CSV format validation failed. See validationErrors for details.',
        validationErrors: validation.rowResults.filter((r) => !r.isValid),
        details: {
          failedAt: new Date().toISOString(),
          attemptedCount: rows.length,
        },
      }
    }

    // Step 2: Validate against database
    validation = await this.validateAgainstDatabase(validation)

    if (!validation.isValid) {
      return {
        success: false,
        reason: 'Database validation failed. See validationErrors for details.',
        validationErrors: validation.rowResults.filter((r) => !r.isValid),
        details: {
          failedAt: new Date().toISOString(),
          attemptedCount: rows.length,
        },
      }
    }

    // Step 3: Execute import (all-or-nothing)
    return this.executeBatchImport(validation)
  }
}

/**
 * Singleton instance of the batch import service
 */
export const batchImportService = new BatchImportService()
