export type UserRole = 'admin' | 'editor' | 'teacher' | 'parent' | 'student';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  displayName?: string;
  roles?: string[];
  teacherClassIds?: string[];
  parentClassIds?: string[];
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  expiresAt: number;
}
