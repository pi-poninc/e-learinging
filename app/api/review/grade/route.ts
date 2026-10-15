import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { skillMapEnabled } from '@/lib/flags'
import { STAFF_ROLES } from '@/lib/review/service'

export async function POST(request: NextRequest) {
  if (!skillMapEnabled()) return NextResponse.json({ error: '機能が無効です' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userGradeId, action, reason } = await request.json()
  if (!userGradeId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'userGradeId と action(approve/reject) が必要です' }, { status: 400 })
  }
  if (action === 'reject' && !reason) {
    return NextResponse.json({ error: '差し戻しには理由が必要です' }, { status: 400 })
  }

  const { data: ug } = await supabase.from('user_grades').select('id, user_id, grade_id, evidence').eq('id', userGradeId).maybeSingle()
  if (!ug) return NextResponse.json({ error: '対象が見つかりません' }, { status: 404 })

  const evidence = { ...(ug.evidence || {}) }
  if (action === 'reject') evidence.reject_reason = reason

  const { error } = await supabase
    .from('user_grades')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      evidence,
    })
    .eq('id', userGradeId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 監査ログ
  await supabase.from('learning_events').insert({
    user_id: ug.user_id,
    event_name: action === 'approve' ? 'grade_approved' : 'grade_rejected',
    properties: { grade_id: ug.grade_id, by: user.id, reason: action === 'reject' ? reason : undefined },
  })

  return NextResponse.json({ ok: true })
}
