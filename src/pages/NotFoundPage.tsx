/**
 * 404 Not Found Page
 * 未找到頁面
 *
 * Displayed when user navigates to non-existent routes
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-waldorf-cream to-waldorf-peach">
      <div className="text-center px-4">
        {/* 404 Display */}
        <div className="mb-8">
          <div className="text-9xl font-bold text-waldorf-clay mb-4">404</div>
          <h1 className="text-4xl font-bold text-waldorf-brown mb-2">頁面未找到</h1>
          <p className="text-xl text-waldorf-sage mb-8">抱歉，您要尋找的頁面不存在。</p>
        </div>

        {/* Error Message */}
        <p className="text-lg text-waldorf-sage mb-8 max-w-md mx-auto">
          該頁面可能已被移除、重新命名或暫時不可用。請檢查 URL 並重試。
        </p>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center flex-wrap">
          <button
            onClick={() => navigate('/')}
            className="px-8 py-3 bg-waldorf-sage text-white rounded-lg font-semibold hover:bg-opacity-90 transition duration-200"
          >
            返回首頁
          </button>

          <button
            onClick={() => navigate(-1)}
            className="px-8 py-3 bg-waldorf-peach text-waldorf-brown rounded-lg font-semibold hover:bg-opacity-90 transition duration-200"
          >
            返回上一頁
          </button>
        </div>

        {/* Helpful Links */}
        <div className="mt-12">
          <p className="text-sm text-waldorf-sage mb-4">您可能對以下內容感興趣：</p>
          <div className="flex gap-4 justify-center flex-wrap text-sm">
            <a href="/week/latest" className="text-waldorf-sage hover:text-waldorf-brown underline">
              最新電子報
            </a>
            <span className="text-waldorf-sage">•</span>
            <a href="/admin/dashboard" className="text-waldorf-sage hover:text-waldorf-brown underline">
              管理員儀表板
            </a>
            <span className="text-waldorf-sage">•</span>
            <a href="/" className="text-waldorf-sage hover:text-waldorf-brown underline">
              首頁
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NotFoundPage
