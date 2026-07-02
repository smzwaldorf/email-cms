/**
 * 頁面 - 錯誤頁面
 * 用於顯示 404、文章刪除、週份不存在等錯誤情況
 */

import { useNavigate } from 'react-router-dom'

export interface ErrorPageProps {
  errorCode?: string
  errorMessage?: string
  title?: string
}

export function ErrorPage({
  errorCode = 'NOT_FOUND',
  errorMessage = '找不到您要的內容',
  title = '發生錯誤',
}: ErrorPageProps) {
  const navigate = useNavigate()

  const getErrorDetails = () => {
    switch (errorCode) {
      case 'ARTICLE_NOT_FOUND':
        return {
          title: '文章不存在',
          message: '您訪問的文章不存在或已被刪除',
          icon: '📄',
        }
      case 'ARTICLE_DELETED':
        return {
          title: '文章已移除',
          message: '您訪問的文章已被編輯者刪除',
          icon: '🗑️',
        }
      case 'WEEK_NOT_FOUND':
        return {
          title: '週份不存在',
          message: '您訪問的週份暫無內容或不存在',
          icon: '📅',
        }
      case 'INVALID_URL':
        return {
          title: '無效的連結',
          message: '您訪問的連結格式有誤',
          icon: '🔗',
        }
      default:
        return {
          title: title,
          message: errorMessage,
          icon: '⚠️',
        }
    }
  }

  const details = getErrorDetails()

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center max-w-md px-4">
        {/* 錯誤圖標 */}
        <div className="text-6xl mb-4">{details.icon}</div>

        {/* 標題 */}
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {details.title}
        </h1>

        {/* 錯誤信息 */}
        <p className="text-gray-600 mb-6">{details.message}</p>

        {/* 錯誤代碼 */}
        {errorCode && (
          <p className="text-sm text-gray-500 mb-6">
            錯誤代碼: <code className="bg-gray-100 px-2 py-1 rounded">{errorCode}</code>
          </p>
        )}

        {/* 返回按鈕 */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            返回首頁
          </button>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
          >
            返回上一頁
          </button>
        </div>
      </div>
    </div>
  )
}
