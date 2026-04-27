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
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) return null

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Profile query error:', profileError.message)
    // Profile doesn't exist yet — return a default
    return { id: user.id, name: user.email || null, role: 'student' }
  }

  if (!profile) {
    // Trigger didn't fire — return fallback
    return { id: user.id, name: user.email || null, role: 'student' }
  }

  return profile as UserProfile
}

export async function requireAuth(): Promise<UserProfile> {
  const user = await getUser()
  if (!user) redirect('/login')

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
