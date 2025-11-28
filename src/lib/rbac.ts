import { AuthUser, UserRole } from '@/types/auth';

export const ROLES: Record<string, UserRole> = {
  ADMIN: 'admin',
  EDITOR: 'editor',
  TEACHER: 'teacher',
  PARENT: 'parent',
};

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,
  editor: 80,
  teacher: 60,
  parent: 40,
};

export function hasRole(user: AuthUser | null, role: UserRole): boolean {
  if (!user) return false;
  return user.role === role;
}

export function hasMinRole(user: AuthUser | null, minRole: UserRole): boolean {
  if (!user) return false;
  return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY[minRole];
}

export function canAccess(user: AuthUser | null, requiredRole: UserRole): boolean {
  return hasMinRole(user, requiredRole);
}

export function requiresAdmin(user: AuthUser | null): boolean {
  return hasRole(user, 'admin');
}

export function requiresTeacher(user: AuthUser | null): boolean {
  return hasMinRole(user, 'teacher');
}
