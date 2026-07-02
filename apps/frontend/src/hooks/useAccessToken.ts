/**
 * Custom Hook: useAccessToken
 * Provides convenient access to the current access token
 * Automatically handles token refresh when needed
 *
 * Usage:
 *   const token = await useAccessToken()
 *   // Use token for API requests
 */

import { useCallback } from 'react'
import { tokenManager } from '@/services/tokenManager'

export const useAccessToken = () => {
  /**
   * Get current access token
   * Triggers auto-refresh if approaching expiry
   */
  const getToken = useCallback(async (): Promise<string | null> => {
    return tokenManager.getAccessToken()
  }, [])

  /**
   * Get token info (expiry details)
   */
  const getTokenInfo = useCallback(() => {
    return tokenManager.getTokenInfo()
  }, [])

  /**
   * Check if token is still valid
   */
  const isTokenValid = useCallback(() => {
    return tokenManager.isAccessTokenValid()
  }, [])

  /**
   * Get time until token expires (seconds)
   */
  const getTimeUntilExpiry = useCallback(() => {
    return tokenManager.getTimeUntilExpiry()
  }, [])

  /**
   * Force manual token refresh (useful for testing)
   */
  const forceRefresh = useCallback(async (): Promise<boolean> => {
    return tokenManager.forceRefresh()
  }, [])

  return {
    getToken,
    getTokenInfo,
    isTokenValid,
    getTimeUntilExpiry,
    forceRefresh,
  }
}
