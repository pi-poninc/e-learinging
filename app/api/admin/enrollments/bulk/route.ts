import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * 指定ユーザーを「公開中の全講座」に一括受講登録する。
 * 既存の受講は onConflict(user_id,course_id) で維持（重複エラーにしない）。
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'instructor'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, dueDate } = await request.json().catch(() => ({ userId: null }))
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  // 公開中の講座すべて
  const { data: courses, error: cErr } = await supabase
    .from('courses').select('id').eq('status', 'published')
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

  const rows = (courses || []).map((c) => ({
    user_id: userId,
    course_id: c.id,
    status: 'active',
    due_date: dueDate || null,
  }))
  if (rows.length === 0) return NextResponse.json({ enrolled: 0, total: 0 })

  const { data, error } = await supabase
    .from('enrollments')
    .upsert(rows, { onConflict: 'user_id,course_id', ignoreDuplicates: false })
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ enrolled: (data || []).length, total: rows.length })
}
