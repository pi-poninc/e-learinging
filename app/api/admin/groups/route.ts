import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !['admin', 'instructor'].includes(profile.role)) return null
  return user
}

// GET: グループ一覧（所属人数つき）
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const svc = await createServiceClient()
  const [{ data: groups }, { data: members }] = await Promise.all([
    svc.from('groups').select('id, name, description, created_at').order('created_at'),
    svc.from('profiles').select('group_id'),
  ])
  const counts: Record<string, number> = {}
  for (const m of members || []) {
    if (m.group_id) counts[m.group_id] = (counts[m.group_id] || 0) + 1
  }
  return NextResponse.json({
    groups: (groups || []).map((g) => ({ ...g, memberCount: counts[g.id] || 0 })),
  })
}

// POST: グループ作成
export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { name, description } = await request.json()
  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'グループ名は必須です' }, { status: 400 })
  }
  const svc = await createServiceClient()
  const { data, error } = await svc
    .from('groups')
    .insert({ name: name.trim(), description: description?.trim() || null })
    .select().single()
  if (error) {
    const msg = error.code === '23505' ? '同名のグループが既にあります' : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ group: data })
}

// DELETE: グループ削除（?id=）。所属者の group_id は自動でnullになる（on delete set null）
export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })
  const svc = await createServiceClient()
  const { error } = await svc.from('groups').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
