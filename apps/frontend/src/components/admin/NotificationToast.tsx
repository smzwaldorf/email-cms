/**
 * Notification Toast Component
 * 通知吐司元件
 * Displays temporary notification messages (success, error, info, warning)
 *
 * Features:
 * - Multiple notification types (success, error, info, warning)
 * - Auto-dismiss after timeout
 * - Close button
 * - Tailwind CSS styling with appropriate colors
 */

import { useEffect, useState } from 'react'

export type NotificationType = 'success' | 'error' | 'info' | 'warning'

export interface NotificationToastProps {
  message: string
  type?: NotificationType
  duration?: number // milliseconds, 0 = no auto-dismiss
  onClose?: () => void
  isVisible?: boolean
}

/**
 * Notification styling by type
 */
const STYLE_BY_TYPE: Record<NotificationType, { bg: string; text: string; icon: string }> = {
  success: {
    bg: 'bg-green-50 border-green-200',
    text: 'text-green-800',
    icon: '✓',
  },
  error: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-800',
    icon: '✕',
  },
  info: {
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-800',
    icon: 'ⓘ',
  },
  warning: {
    bg: 'bg-yellow-50 border-yellow-200',
    text: 'text-yellow-800',
    icon: '⚠',
  },
}

/**
 * Notification Toast Component
 */
export function NotificationToast({
  message,
  type = 'info',
  duration = 5000,
  onClose,
  isVisible = true,
}: NotificationToastProps) {
  const [visible, setVisible] = useState(isVisible)

  /**
   * Auto-dismiss notification after duration
   */
  useEffect(() => {
    if (!visible || duration === 0) return

    const timer = setTimeout(() => {
      handleClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [visible, duration])

  /**
   * Handle close
   */
  const handleClose = () => {
    setVisible(false)
    onClose?.()
  }

  if (!visible) return null

  const style = STYLE_BY_TYPE[type]

  return (
    <div
      className={`fixed bottom-4 right-4 max-w-md p-4 border rounded-lg ${style.bg} ${style.text} shadow-lg z-50 animate-fade-in`}
      data-testid={`notification-${type}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 text-lg font-bold">{style.icon}</span>
        <div className="flex-1">
          <p className="text-sm font-medium">{message}</p>
        </div>
        <button
          onClick={handleClose}
          className="flex-shrink-0 text-lg font-bold opacity-50 hover:opacity-100 transition-opacity"
          aria-label="Close notification"
          data-testid="close-btn"
        >
          ×
        </button>
      </div>
    </div>
  )
}

/**
 * Notification Toast Container
 * Container for multiple notifications
 */
export interface NotificationToastContainerProps {
  notifications: Array<{
    id: string
    message: string
    type?: NotificationType
    duration?: number
  }>
  onClose?: (id: string) => void
}

export function NotificationToastContainer({
  notifications,
  onClose,
}: NotificationToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          message={notification.message}
          type={notification.type}
          duration={notification.duration}
          onClose={() => onClose?.(notification.id)}
          isVisible={true}
        />
      ))}
    </div>
  )
}

export default NotificationToast
