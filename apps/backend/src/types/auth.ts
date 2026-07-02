export type UserRole = 'admin' | 'editor' | 'teacher' | 'parent';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  displayName?: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  expiresAt: number;
}
