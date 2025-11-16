/**
 * 認證服務
 * 處理編輯者身份認證和權限檢查
 * 注意：這是一個模擬實現，實際應用應該連接到真實的認證後端
 */

export interface AuthUser {
  id: string
  username: string
  email: string
  role: 'viewer' | 'editor' | 'admin'
  permissions: string[]
}

export interface AuthServiceInterface {
  isAuthenticated: () => boolean
  getCurrentUser: () => AuthUser | null
  hasPermission: (permission: string) => boolean
  canEditArticles: () => boolean
  canDeleteArticles: () => boolean
  canReorderArticles: () => boolean
  logout: () => void
}

class MockAuthService implements AuthServiceInterface {
  private currentUser: AuthUser | null = null

  constructor() {
    // Initialize with a mock editor user
    this.currentUser = {
      id: 'editor-001',
      username: 'editor',
      email: 'editor@example.com',
      role: 'editor',
      permissions: ['article:read', 'article:write', 'article:delete', 'article:reorder'],
    }
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUser
  }

  hasPermission(permission: string): boolean {
    if (!this.currentUser) {
      return false
    }

    // Admin has all permissions
    if (this.currentUser.role === 'admin') {
      return true
    }

    return this.currentUser.permissions.includes(permission)
  }

  canEditArticles(): boolean {
    return this.hasPermission('article:write')
  }

  canDeleteArticles(): boolean {
    return this.hasPermission('article:delete')
  }

  canReorderArticles(): boolean {
    return this.hasPermission('article:reorder')
  }

  logout(): void {
    this.currentUser = null
  }

  /**
   * Mock login for testing purposes
   * In real application, this would call an actual auth API
   */
  mockLogin(user: AuthUser): void {
    this.currentUser = user
  }
}

// Singleton instance
const authService = new MockAuthService()

export { authService }
export default authService
