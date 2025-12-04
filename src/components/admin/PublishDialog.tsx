import React, { useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'

export interface PublishDialogProps {
  isOpen: boolean
  newsletterWeek: string
  articleCount: number
  onPublish: () => Promise<void>
  onCancel: () => void
}

export function PublishDialog({
  isOpen,
  newsletterWeek,
  articleCount,
  onPublish,
  onCancel,
}: PublishDialogProps) {
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    if (articleCount === 0) {
      setError('電子報必須包含至少一篇文章才能發布')
      return
    }

    try {
      setIsPublishing(true)
      setError(null)
      await onPublish()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '發布電子報時出錯'
      )
    } finally {
      setIsPublishing(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-bold mb-4 text-gray-900">
          確認發布電子報
        </h3>

        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-gray-700 mb-3">
            您即將發布 <strong>{newsletterWeek}</strong> 期的電子報
          </p>
          <p className="text-sm text-gray-600">
            文章數: <strong>{articleCount}</strong>
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2 mb-6">
          <p className="text-sm text-gray-600">
            發布後，此電子報將對讀者可見。您隨時可以將其封存。
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isPublishing}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPublishing || articleCount === 0}
            className="px-4 py-2 text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPublishing ? '發布中...' : '確認發布'}
          </button>
        </div>
      </div>
    </div>
  )
}
