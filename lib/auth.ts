import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type UserRole = 'admin' | 'instructor' | 'student'

export interface UserProfile {
  id: string
  name: string | null
  role: UserRole
}

export async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', user.id)
    .single()

  return profile as UserProfile | null
}

export async function requireAuth(): Promise<UserProfile> {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')
  return profile
}

export async function requireAdmin(): Promise<UserProfile> {
  const profile = await requireAuth()
  if (!['admin', 'instructor'].includes(profile.role)) {
    redirect('/dashboard')
  }
  return profile
}
