import type { UserRole } from '@/lib/auth'

export function isAdmin(role: UserRole): boolean {
  return role === 'admin' || role === 'instructor'
}

export function canAccessAdmin(role: UserRole): boolean {
  return isAdmin(role)
}

export function canManageCourses(role: UserRole): boolean {
  return isAdmin(role)
}

export function canManageEnrollments(role: UserRole): boolean {
  return isAdmin(role)
}

export function canViewAllProgress(role: UserRole): boolean {
  return isAdmin(role)
}
