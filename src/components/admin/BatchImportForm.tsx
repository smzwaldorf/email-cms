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
  const [csvText, setCSVText] = useState('')
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
      setCSVText(text)

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
        setCSVText('')
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
    setCSVText('')
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
        <label className="block text-sm font-medium text-gray-700">CSV 文件</label>

        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            isDragging
              ? 'border-waldorf-sage-500 bg-waldorf-sage-50'
              : 'border-gray-300 bg-gray-50'
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
            className="space-y-2"
          >
            <p className="text-sm font-medium text-gray-700">拖放 CSV 文件到此處</p>
            <p className="text-xs text-gray-500">或點擊選擇文件</p>
          </div>
        </div>

        {csvRows.length > 0 && (
          <p className="text-sm text-gray-600">
            已選擇: <span className="font-semibold">{csvRows.length} 行</span>
          </p>
        )}
      </div>

      {/* CSV Preview */}
      {csvRows.length > 0 && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">預覽</label>

          <div className="max-h-60 overflow-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">#</th>
                  {Object.keys(csvRows[0]).map((header) => (
                    <th
                      key={header}
                      className="px-4 py-2 text-left text-xs font-medium text-gray-700"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvRows.slice(0, 10).map((row, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="px-4 py-2 text-xs text-gray-600">{index + 1}</td>
                    {Object.values(row).map((value, colIndex) => (
                      <td key={colIndex} className="px-4 py-2 text-xs text-gray-600">
                        {String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {csvRows.length > 10 && (
            <p className="text-xs text-gray-500">
              顯示前 10 行，共 {csvRows.length} 行
            </p>
          )}
        </div>
      )}

      {/* Validation Errors */}
      {validation && !validation.isValid && (
        <div className="rounded-lg bg-red-50 p-4">
          <h4 className="mb-2 text-sm font-semibold text-red-700">驗證錯誤</h4>
          <div className="max-h-40 space-y-1 overflow-auto">
            {validation.rowResults
              .filter((r) => !r.isValid)
              .slice(0, 10)
              .map((result) => (
                <div key={result.rowNumber} className="text-xs text-red-600">
                  <strong>第 {result.rowNumber} 行:</strong> {result.errors.join('; ')}
                </div>
              ))}
          </div>
          {validation.rowResults.filter((r) => !r.isValid).length > 10 && (
            <p className="mt-2 text-xs text-red-600">
              + {validation.rowResults.filter((r) => !r.isValid).length - 10} 個錯誤
            </p>
          )}
        </div>
      )}

      {/* Validation Success */}
      {validation && validation.isValid && (
        <div className="rounded-lg bg-green-50 p-4">
          <p className="text-sm font-medium text-green-700">✓ 驗證成功</p>
          <p className="mt-1 text-xs text-green-600">
            準備導入 {validation.validRows} 個有效用戶
          </p>
        </div>
      )}

      {/* Import Result */}
      {importResult && (
        <div
          className={`rounded-lg p-4 ${
            importResult.success ? 'bg-green-50' : 'bg-red-50'
          }`}
        >
          <p
            className={`text-sm font-medium ${
              importResult.success ? 'text-green-700' : 'text-red-700'
            }`}
          >
            {importResult.success ? '✓ 導入成功' : '✗ 導入失敗'}
          </p>
          <p className={`mt-1 text-xs ${
            importResult.success ? 'text-green-600' : 'text-red-600'
          }`}>
            {importResult.success
              ? `已導入 ${importResult.importedCount} 個用戶`
              : importResult.reason}
          </p>
        </div>
      )}

      {/* Required Column Info */}
      <div className="rounded-lg bg-blue-50 p-4">
        <p className="text-xs font-medium text-blue-700">必需欄位 (CSV 標題):</p>
        <ul className="mt-2 space-y-1 text-xs text-blue-600">
          <li>• <strong>email</strong> - 用戶電子郵件地址</li>
          <li>• <strong>name</strong> - 用戶姓名</li>
          <li>• <strong>role</strong> - 用戶角色 (admin, teacher, parent, student)</li>
          <li>• <strong>status</strong> (選填) - 用戶狀態 (active, disabled, pending_approval)</li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {csvRows.length > 0 && !validation && (
          <button
            onClick={handleValidate}
            disabled={disabled || isValidating}
            className="rounded-lg bg-waldorf-sage-600 px-4 py-2 text-sm font-medium text-white hover:bg-waldorf-sage-700 disabled:opacity-50"
          >
            {isValidating ? '驗證中...' : '驗證'}
          </button>
        )}

        {validation && validation.isValid && !importResult && (
          <button
            onClick={handleImport}
            disabled={disabled || isImporting}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isImporting ? '導入中...' : '確認導入'}
          </button>
        )}

        {csvRows.length > 0 && (
          <button
            onClick={handleReset}
            disabled={disabled || isValidating || isImporting}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            重置
          </button>
        )}
      </div>
    </div>
  )
}
