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

// GET: お知らせ一覧（グループ名つき）
export async function GET() {
  if (!(await requireAdminUser())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const svc = await createServiceClient()
  const [{ data: anns }, { data: groups }] = await Promise.all([
    svc.from('announcements').select('id, title, body, group_id, created_at').order('created_at', { ascending: false }),
    svc.from('groups').select('id, name'),
  ])
  const gname: Record<string, string> = {}
  for (const g of groups || []) gname[g.id] = g.name
  return NextResponse.json({
    announcements: (anns || []).map((a) => ({
      ...a, groupLabel: a.group_id ? (gname[a.group_id] || '—') : '全員',
    })),
  })
}

// POST: 作成
export async function POST(request: NextRequest) {
  const user = await requireAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { title, body, groupId } = await request.json()
  if (!title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'タイトルと本文は必須です' }, { status: 400 })
  }
  const svc = await createServiceClient()
  const { data, error } = await svc.from('announcements')
    .insert({ title: title.trim(), body: body.trim(), group_id: groupId || null, created_by: user.id })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ announcement: data })
}

// DELETE: ?id=
export async function DELETE(request: NextRequest) {
  if (!(await requireAdminUser())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })
  const svc = await createServiceClient()
  const { error } = await svc.from('announcements').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
