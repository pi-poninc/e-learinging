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

// GET: 全投稿（投稿者名・紐づけ講座つき）
export async function GET() {
  if (!(await requireAdminUser())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const svc = await createServiceClient()
  const [{ data: subs }, { data: profiles }, { data: courses }] = await Promise.all([
    svc.from('content_submissions').select('*').order('created_at', { ascending: false }),
    svc.from('profiles').select('id, name'),
    svc.from('courses').select('id, title'),
  ])
  const pname: Record<string, string> = {}
  for (const p of profiles || []) pname[p.id] = p.name || p.id
  const cname: Record<string, string> = {}
  for (const c of courses || []) cname[c.id] = c.title
  return NextResponse.json({
    submissions: (subs || []).map((s) => ({
      ...s,
      submitterName: pname[s.user_id] || s.user_id,
      courseTitle: s.course_id ? (cname[s.course_id] || '—') : null,
    })),
    courses: courses || [],
  })
}

// PATCH: ステータス・メモ・紐づけ講座を更新
export async function PATCH(request: NextRequest) {
  if (!(await requireAdminUser())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id, status, adminNote, courseId } = await request.json()
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status !== undefined) {
    if (!['new', 'in_progress', 'done', 'rejected'].includes(status)) {
      return NextResponse.json({ error: '無効なステータス' }, { status: 400 })
    }
    patch.status = status
  }
  if (adminNote !== undefined) patch.admin_note = adminNote || null
  if (courseId !== undefined) patch.course_id = courseId || null
  const svc = await createServiceClient()
  const { error } = await svc.from('content_submissions').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
