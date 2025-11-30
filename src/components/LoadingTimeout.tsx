/**
 * Hook to detect when a loading state has taken too long
 * Shows an error message if loading exceeds the timeout threshold
 */

import { useState, useEffect } from 'react'

export interface UseLoadingTimeoutResult {
  isTimedOut: boolean
  reset: () => void
}

/**
 * Detects if a loading state has exceeded the timeout threshold
 * @param isLoading - Current loading state
 * @param timeoutMs - Timeout in milliseconds (default: 60000 = 60 seconds)
 * @returns Object with isTimedOut flag and reset function
 */
export function useLoadingTimeout(isLoading: boolean, timeoutMs = 60000): UseLoadingTimeoutResult {
  const [isTimedOut, setIsTimedOut] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setIsTimedOut(false)
      return
    }

    const timeoutId = setTimeout(() => {
      setIsTimedOut(true)
      console.warn(`⏱️ Loading timeout exceeded: ${timeoutMs}ms`)
    }, timeoutMs)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [isLoading, timeoutMs])

  const reset = () => {
    setIsTimedOut(false)
  }

  return { isTimedOut, reset }
}
