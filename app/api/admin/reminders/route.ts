import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { collectTargets, sendReminders } from '@/lib/reminders'

async function requireAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !['admin', 'instructor'].includes(profile.role)) return null
  return user
}

// GET: 対象一覧（dry-run。送信はしない）
export async function GET() {
  if (!(await requireAdminUser())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const targets = await collectTargets()
  return NextResponse.json({ targets, emailConfigured: !!process.env.RESEND_API_KEY })
}

// POST: リマインドメール送信（RESEND_API_KEY があれば実送信、無ければ未設定を返す）
export async function POST() {
  if (!(await requireAdminUser())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const targets = await collectTargets()
  const result = await sendReminders(targets)
  return NextResponse.json(result)
}
