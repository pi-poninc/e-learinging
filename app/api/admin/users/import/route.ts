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

interface Row { name?: string; email?: string; password?: string; groupId?: string | null }

// POST: 受講者の一括登録。 body = { rows: Row[], courseIds: string[] }
// 各行: auth ユーザー作成 → profile(role=student, name, group_id) → 指定講座に受講登録
export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { rows, courseIds } = (await request.json()) as { rows: Row[]; courseIds?: string[] }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'データがありません' }, { status: 400 })
  }
  const svc = await createServiceClient()
  const results: { email: string; ok: boolean; message: string }[] = []

  for (const r of rows) {
    const email = (r.email || '').trim()
    const password = (r.password || '').trim()
    const name = (r.name || '').trim() || email
    if (!email || !password) {
      results.push({ email: email || '(空)', ok: false, message: 'メール/パスワードが空' })
      continue
    }
    if (password.length < 6) {
      results.push({ email, ok: false, message: 'パスワードは6文字以上' })
      continue
    }
    const { data: created, error: createErr } = await svc.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { name, role: 'student' },
    })
    if (createErr || !created.user) {
      results.push({ email, ok: false, message: createErr?.message || '作成失敗' })
      continue
    }
    const uid = created.user.id
    // profile を確定（トリガで作成済みのはずだが upsert で上書き）
    await svc.from('profiles').upsert(
      { id: uid, name, role: 'student', group_id: r.groupId || null },
      { onConflict: 'id' }
    )
    // 講座に受講登録
    if (courseIds && courseIds.length) {
      await svc.from('enrollments').upsert(
        courseIds.map((cid) => ({ user_id: uid, course_id: cid, status: 'active' })),
        { onConflict: 'user_id,course_id' }
      )
    }
    results.push({ email, ok: true, message: '登録OK' })
  }

  const okCount = results.filter((r) => r.ok).length
  return NextResponse.json({ okCount, total: rows.length, results })
}
