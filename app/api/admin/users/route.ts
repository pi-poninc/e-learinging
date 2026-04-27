import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['admin', 'instructor'].includes(profile.role)) return null
  return user
}

// POST: Create new user
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const admin = await checkAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, password, name, role } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'メールアドレスとパスワードは必須です' }, { status: 400 })
  }

  if (role && !['admin', 'instructor', 'student'].includes(role)) {
    return NextResponse.json({ error: '無効なロールです' }, { status: 400 })
  }

  // Use service role client to create user (bypasses email confirmation)
  const serviceClient = await createServiceClient()
  const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Skip email confirmation
    user_metadata: { name: name || email, role: role || 'student' },
  })

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  // Update role in profiles (trigger should have created the profile, but update role just in case)
  if (newUser.user && role) {
    await serviceClient
      .from('profiles')
      .upsert({
        id: newUser.user.id,
        name: name || email,
        role: role,
      }, { onConflict: 'id' })
  }

  return NextResponse.json({ user: { id: newUser.user?.id, email } })
}

// PATCH: Update user role
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const admin = await checkAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, role } = await request.json()

  if (!userId || !role) {
    return NextResponse.json({ error: 'userId と role は必���です' }, { status: 400 })
  }

  if (!['admin', 'instructor', 'student'].includes(role)) {
    return NextResponse.json({ error: '無効なロールです' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()
  const { error } = await serviceClient
    .from('profiles')
    .update({ role })
    .eq('id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
