/**
 * 元件 - 錯誤邊界
 * 捕獲子元件中的渲染錯誤，防止應用程式完全崩潰
 */

import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: (error: Error) => React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 記錄錯誤訊息到控制台
    console.error('ErrorBoundary caught an error:', error)
    console.error('Error Info:', errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    // 刷新頁面以重置應用狀態
    window.location.reload()
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // 如果提供了自訂 fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback(this.state.error)
      }

      // 預設錯誤 UI
      return (
        <div className="flex items-center justify-center h-screen bg-red-50">
          <div className="text-center max-w-md px-4">
            <div className="text-6xl mb-4">❌</div>

            <h1 className="text-3xl font-bold text-red-900 mb-2">
              應用程式出錯
            </h1>

            <p className="text-red-700 mb-6">
              抱歉，應用程式遇到意外錯誤。請重新載入頁面。
            </p>

            {/* 錯誤詳情（開發模式） */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mb-6 p-4 bg-red-100 rounded text-left">
                <p className="text-sm font-semibold text-red-900 mb-2">
                  錯誤詳情:
                </p>
                <code className="text-xs text-red-800 whitespace-pre-wrap break-words">
                  {this.state.error.message}
                </code>
              </div>
            )}

            {/* 按鈕 */}
            <button
              onClick={this.handleReset}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              重新載入
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
