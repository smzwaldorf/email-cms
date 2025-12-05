/**
 * Batch Import Form Component
 * 批量導入表單 - 用於 CSV 用戶導入
 *
 * Features:
 * - CSV file upload with drag-and-drop
 * - Validation preview before import
 * - All-or-nothing import strategy
 * - Detailed error reporting
 * - Import progress and results
 */

import { useState, useRef } from 'react'
import { batchImportService } from '@/services/batchImportService'
import type { BatchImportResult, BatchValidationResult } from '@/services/batchImportService'

export interface BatchImportFormProps {
  onImportComplete?: (result: BatchImportResult) => void
  onValidationComplete?: (validation: BatchValidationResult) => void
  disabled?: boolean
}

/**
 * Parse CSV string into rows
 * 將 CSV 字符串解析為行
 */
function parseCSV(csvText: string): string[][] {
  const lines = csvText.trim().split('\n')
  return lines.map((line) => {
    // Simple CSV parsing - handles basic cases
    return line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''))
  })
}

/**
 * Convert CSV rows to objects with headers
 * 將 CSV 行轉換為帶標題的物件
 */
function csvToObjects(rows: string[][]): Record<string, any>[] {
  if (rows.length < 2) {
    return []
  }

  const headers = rows[0]
  const objects = rows.slice(1).map((row) => {
    const obj: Record<string, any> = {}
    headers.forEach((header, index) => {
      obj[header] = row[index] || ''
    })
    return obj
  })

  return objects
}

/**
 * Batch Import Form Component
 */
export function BatchImportForm({
  onImportComplete,
  onValidationComplete,
  disabled = false,
}: BatchImportFormProps) {
  const [csvRows, setCSVRows] = useState<Record<string, any>[]>([])
  const [validation, setValidation] = useState<BatchValidationResult | null>(null)
  const [importResult, setImportResult] = useState<BatchImportResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * Handle file selection
   * 處理文件選擇
   */
  const handleFileSelect = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string

      // Parse CSV
      const rows = parseCSV(text)
      const objects = csvToObjects(rows)
      setCSVRows(objects)
    }
    reader.readAsText(file)
  }

  /**
   * Handle drag and drop
   * 處理拖放
   */
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file && file.type === 'text/csv' && file.name.endsWith('.csv')) {
      handleFileSelect(file)
    }
  }

  /**
   * Handle file input change
   * 處理文件輸入變更
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  /**
   * Validate CSV before import
   * 在導入前驗證 CSV
   */
  const handleValidate = async () => {
    if (csvRows.length === 0) {
      alert('請先上傳 CSV 文件')
      return
    }

    setIsValidating(true)
    try {
      // Validate CSV format
      let validation = batchImportService.validateCSVFormat(csvRows)

      // Validate against database
      if (validation.isValid) {
        validation = await batchImportService.validateAgainstDatabase(validation)
      }

      setValidation(validation)
      if (onValidationComplete) {
        onValidationComplete(validation)
      }

      // Show validation summary
      if (!validation.isValid) {
        alert(
          `驗證失敗\n\n無效行數: ${validation.invalidRows}\n\n請檢查错誤詳細資訊`
        )
      } else {
        alert(`驗證成功！\n\n將導入 ${validation.validRows} 個用戶`)
      }
    } catch (error) {
      alert(`驗證錯誤: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsValidating(false)
    }
  }

  /**
   * Execute batch import
   * 執行批量導入
   */
  const handleImport = async () => {
    if (!validation || !validation.isValid) {
      alert('請先驗證 CSV 文件')
      return
    }

    setIsImporting(true)
    try {
      const result = await batchImportService.executeBatchImport(validation)
      setImportResult(result)

      if (onImportComplete) {
        onImportComplete(result)
      }

      if (result.success) {
        alert(`導入成功！\n\n已導入 ${result.importedCount} 個用戶`)
        // Reset form
        setCSVRows([])
        setValidation(null)
      } else {
        alert(`導入失敗: ${result.reason}`)
      }
    } catch (error) {
      alert(`導入錯誤: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsImporting(false)
    }
  }

  /**
   * Reset form
   * 重置表單
   */
  const handleReset = () => {
    setCSVRows([])
    setValidation(null)
    setImportResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      {/* File Upload */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-waldorf-clay-700">CSV 文件</label>

        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200 ${
            isDragging
              ? 'border-waldorf-sage-400 bg-waldorf-sage-50 shadow-md'
              : 'border-waldorf-cream-300 bg-waldorf-cream-50'
          } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleInputChange}
            disabled={disabled}
            className="hidden"
          />

          <div
            onClick={() => !disabled && fileInputRef.current?.click()}
            className="space-y-3"
          >
            <svg className="w-10 h-10 mx-auto text-waldorf-sage-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            <p className="text-sm font-semibold text-waldorf-clay-700">拖放 CSV 文件到此處</p>
            <p className="text-xs text-waldorf-clay-500">或點擊選擇文件</p>
          </div>
        </div>

        {csvRows.length > 0 && (
          <p className="text-sm text-waldorf-clay-600">
            已選擇: <span className="font-semibold text-waldorf-sage-600">{csvRows.length} 行</span>
          </p>
        )}
      </div>

      {/* CSV Preview */}
      {csvRows.length > 0 && (
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-waldorf-clay-700">預覽</label>

          <div className="max-h-60 overflow-auto rounded-xl border border-waldorf-cream-200 bg-white/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-waldorf-cream-200 bg-gradient-to-r from-waldorf-cream-100 to-waldorf-cream-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-waldorf-clay-600">#</th>
                  {Object.keys(csvRows[0]).map((header) => (
                    <th
                      key={header}
                      className="px-4 py-3 text-left text-xs font-semibold text-waldorf-clay-600"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-waldorf-cream-100">
                {csvRows.slice(0, 10).map((row, index) => (
                  <tr key={index} className="hover:bg-waldorf-cream-50/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-waldorf-clay-600 font-medium">{index + 1}</td>
                    {Object.values(row).map((value, colIndex) => (
                      <td key={colIndex} className="px-4 py-3 text-xs text-waldorf-clay-600">
                        {String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {csvRows.length > 10 && (
            <p className="text-xs text-waldorf-clay-500">
              顯示前 10 行，共 {csvRows.length} 行
            </p>
          )}
        </div>
      )}

      {/* Validation Errors */}
      {validation && !validation.isValid && (
        <div className="rounded-2xl bg-waldorf-rose-50 border border-waldorf-rose-200 p-4">
          <h4 className="mb-3 text-sm font-semibold text-waldorf-rose-800 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
            </svg>
            驗證錯誤
          </h4>
          <div className="max-h-40 space-y-1 overflow-auto">
            {validation.rowResults
              .filter((r) => !r.isValid)
              .slice(0, 10)
              .map((result) => (
                <div key={result.rowNumber} className="text-xs text-waldorf-rose-700">
                  <strong>第 {result.rowNumber} 行:</strong> {result.errors.join('; ')}
                </div>
              ))}
          </div>
          {validation.rowResults.filter((r) => !r.isValid).length > 10 && (
            <p className="mt-2 text-xs text-waldorf-rose-700">
              + {validation.rowResults.filter((r) => !r.isValid).length - 10} 個錯誤
            </p>
          )}
        </div>
      )}

      {/* Validation Success */}
      {validation && validation.isValid && (
        <div className="rounded-2xl bg-waldorf-sage-50 border border-waldorf-sage-200 p-4">
          <p className="text-sm font-semibold text-waldorf-sage-800 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
            </svg>
            驗證成功
          </p>
          <p className="mt-2 text-xs text-waldorf-sage-700">
            準備導入 <span className="font-semibold">{validation.validRows}</span> 個有效用戶
          </p>
        </div>
      )}

      {/* Import Result */}
      {importResult && (
        <div
          className={`rounded-2xl border p-4 ${
            importResult.success
              ? 'bg-waldorf-sage-50 border-waldorf-sage-200'
              : 'bg-waldorf-rose-50 border-waldorf-rose-200'
          }`}
        >
          <p
            className={`text-sm font-semibold flex items-center gap-2 ${
              importResult.success ? 'text-waldorf-sage-800' : 'text-waldorf-rose-800'
            }`}
          >
            {importResult.success ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
              </svg>
            )}
            {importResult.success ? '導入成功' : '導入失敗'}
          </p>
          <p className={`mt-2 text-xs ${
            importResult.success ? 'text-waldorf-sage-700' : 'text-waldorf-rose-700'
          }`}>
            {importResult.success
              ? `已導入 ${importResult.importedCount} 個用戶`
              : importResult.reason}
          </p>
        </div>
      )}

      {/* Required Column Info */}
      <div className="rounded-2xl bg-waldorf-lavender-50 border border-waldorf-lavender-200 p-4">
        <p className="text-xs font-semibold text-waldorf-lavender-800 flex items-center gap-2 mb-3">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zm-11-1a1 1 0 11-2 0 1 1 0 012 0z" />
          </svg>
          必需欄位 (CSV 標題)
        </p>
        <ul className="space-y-2 text-xs text-waldorf-lavender-700">
          <li className="flex gap-2"><span className="text-waldorf-lavender-500">•</span><span><strong>email</strong> - 用戶電子郵件地址</span></li>
          <li className="flex gap-2"><span className="text-waldorf-lavender-500">•</span><span><strong>name</strong> - 用戶姓名</span></li>
          <li className="flex gap-2"><span className="text-waldorf-lavender-500">•</span><span><strong>role</strong> - 用戶角色 (admin, teacher, parent, student)</span></li>
          <li className="flex gap-2"><span className="text-waldorf-lavender-500">•</span><span><strong>status</strong> (選填) - 用戶狀態 (active, disabled, pending_approval)</span></li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap">
        {csvRows.length > 0 && !validation && (
          <button
            onClick={handleValidate}
            disabled={disabled || isValidating}
            className="px-6 py-2.5 text-white bg-gradient-to-r from-waldorf-sage-500 to-waldorf-sage-600 hover:from-waldorf-sage-600 hover:to-waldorf-sage-700 rounded-xl font-medium transition-all duration-200 shadow-lg shadow-waldorf-sage-200/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isValidating ? '驗證中...' : '驗證'}
          </button>
        )}

        {validation && validation.isValid && !importResult && (
          <button
            onClick={handleImport}
            disabled={disabled || isImporting}
            className="px-6 py-2.5 text-white bg-gradient-to-r from-waldorf-peach-500 to-waldorf-peach-600 hover:from-waldorf-peach-600 hover:to-waldorf-peach-700 rounded-xl font-medium transition-all duration-200 shadow-lg shadow-waldorf-peach-200/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImporting ? '導入中...' : '確認導入'}
          </button>
        )}

        {csvRows.length > 0 && (
          <button
            onClick={handleReset}
            disabled={disabled || isValidating || isImporting}
            className="px-6 py-2.5 border border-waldorf-cream-300 rounded-xl text-sm font-medium text-waldorf-clay-700 hover:bg-waldorf-cream-100 transition-all duration-200 disabled:opacity-50"
          >
            重置
          </button>
        )}
      </div>
    </div>
  )
}
