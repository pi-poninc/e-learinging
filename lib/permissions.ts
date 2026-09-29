import type { UserRole } from '@/lib/auth'

export function isAdmin(role: UserRole): boolean {
  return role === 'admin' || role === 'instructor'
}

export function isManager(role: UserRole): boolean {
  return role === 'manager'
}

// admin / instructor / manager。チーム進捗の閲覧が可能な人。
export function isStaff(role: UserRole): boolean {
  return isAdmin(role) || isManager(role)
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
