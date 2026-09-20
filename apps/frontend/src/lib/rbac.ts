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
  student: 0,
};

export function hasRole(user: AuthUser | null, role: UserRole): boolean {
  if (!user) return false;
  return user.role === role || user.roles?.includes(role) === true;
}

export function hasMinRole(user: AuthUser | null, minRole: UserRole): boolean {
  if (!user) return false;
  const ranked = [user.role, ...(user.roles ?? [])]
    .map(role => ROLE_HIERARCHY[role as UserRole])
    .filter((value): value is number => value !== undefined)
  return ranked.some(value => value >= ROLE_HIERARCHY[minRole])
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
