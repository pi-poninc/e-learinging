import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { peerReviewEnabled } from '@/lib/flags'
import { STAFF_ROLES, getReviewSettings } from '@/lib/review/service'

// 卒業生（受講者）を添削者として認定する。最初のN件はベテラン確認が必要（needs_approval_remaining）。
export async function POST(request: NextRequest) {
  if (!peerReviewEnabled()) return NextResponse.json({ error: '機能が無効です' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF_ROLES.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, courseId } = await request.json()
  if (!userId) return NextResponse.json({ error: 'userId が必要です' }, { status: 400 })

  const { data: target } = await supabase.from('profiles').select('name').eq('id', userId).maybeSingle()
  const settings = courseId ? await getReviewSettings(supabase, courseId) : null
  const checkCount = settings?.newReviewerCheckCount ?? 10

  // 認定対象の担当コース（本人の受講中コース）
  const { data: enr } = await supabase.from('enrollments').select('course_id').eq('user_id', userId).eq('status', 'active')
  const courseIds = (enr || []).map((e) => e.course_id)

  const { error } = await supabase.from('reviewer_profiles').upsert({
    user_id: userId,
    display_name: target?.name || '添削者',
    course_ids: courseIds,
    is_active: true,
    needs_approval_remaining: checkCount,
  }, { onConflict: 'user_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('learning_events').insert({ user_id: userId, event_name: 'reviewer_promoted', properties: { by: user.id, check_count: checkCount } })
  return NextResponse.json({ ok: true })
}
