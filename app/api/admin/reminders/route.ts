import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function requireAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !['admin', 'instructor'].includes(profile.role)) return null
  return user
}

// 期限切れ or 期限が近い(既定3日)未修了の受講を抽出
async function collectTargets(withinDays = 3) {
  const svc = await createServiceClient()
  const today = new Date()
  const limit = new Date(today)
  limit.setDate(limit.getDate() + withinDays)
  const limitStr = limit.toISOString().slice(0, 10)

  const { data: enrollments } = await svc
    .from('enrollments')
    .select('id, due_date, user_id, status, course:courses(title)')
    .eq('status', 'active')
    .not('due_date', 'is', null)
    .lte('due_date', limitStr)

  // メールアドレスを引く（auth）
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const emailById: Record<string, string> = {}
  const nameById: Record<string, string> = {}
  for (const u of list?.users || []) {
    emailById[u.id] = u.email || ''
    nameById[u.id] = (u.user_metadata?.name as string) || u.email || ''
  }

  const todayStr = today.toISOString().slice(0, 10)
  return (enrollments || []).map((e) => {
    const course = e.course as unknown as { title: string } | null
    const overdue = (e.due_date as string) < todayStr
    return {
      enrollmentId: e.id,
      email: emailById[e.user_id] || '',
      name: nameById[e.user_id] || '',
      courseTitle: course?.title || '',
      dueDate: e.due_date as string,
      overdue,
    }
  }).filter((t) => t.email)
}

// GET: 対象一覧（dry-run。送信はしない）
export async function GET() {
  if (!(await requireAdminUser())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const targets = await collectTargets()
  return NextResponse.json({ targets, emailConfigured: !!process.env.RESEND_API_KEY })
}

// POST: リマインドメール送信（RESEND_API_KEY があれば実送信、無ければ未設定を返す）
export async function POST(request: NextRequest) {
  if (!(await requireAdminUser())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const targets = await collectTargets()
  const key = process.env.RESEND_API_KEY
  const from = process.env.REMINDER_FROM || 'onboarding@resend.dev'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  if (!key) {
    return NextResponse.json({
      sent: 0, total: targets.length, emailConfigured: false,
      note: 'RESEND_API_KEY が未設定です。メール送信は行われていません（対象のみ集計）。',
    })
  }

  let sent = 0
  const errors: string[] = []
  for (const t of targets) {
    const subject = t.overdue
      ? `【受講期限切れ】「${t.courseTitle}」の受講をお願いします`
      : `【受講期限が近づいています】「${t.courseTitle}」`
    const text =
      `${t.name} さん\n\n` +
      `講座「${t.courseTitle}」の受講期限は ${t.dueDate} です。` +
      `${t.overdue ? '期限を過ぎています。' : 'もうすぐ期限です。'}\n` +
      `まだ修了していないレッスンがあります。以下からご受講ください。\n${appUrl}/dashboard\n`
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: t.email, subject, text }),
      })
      if (res.ok) sent++
      else errors.push(`${t.email}: ${(await res.json())?.message || res.status}`)
    } catch (e) {
      errors.push(`${t.email}: ${(e as Error).message}`)
    }
  }
  return NextResponse.json({ sent, total: targets.length, emailConfigured: true, errors })
}
