import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { submissionReviewEnabled } from '@/lib/flags'
import { STAFF_ROLES } from '@/lib/review/service'
import { finalizeReview } from '@/lib/review/finalize'

// 新任添削者の添削（pending_approval）を、ベテランが確認して公開 or 差し戻し
export async function POST(request: NextRequest) {
  if (!submissionReviewEnabled()) return NextResponse.json({ error: '機能が無効です' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { submissionId, action } = await request.json()
  if (!submissionId || !['approve', 'request_changes'].includes(action)) {
    return NextResponse.json({ error: 'submissionId と action が必要です' }, { status: 400 })
  }

  const { data: fb } = await supabase
    .from('review_feedback').select('id, reviewer_id, status').eq('submission_id', submissionId).maybeSingle()
  if (!fb || fb.status !== 'pending_approval') {
    return NextResponse.json({ error: '確認待ちの添削が見つかりません' }, { status: 404 })
  }
  if (fb.reviewer_id === user.id) {
    return NextResponse.json({ error: '自分の添削は自分で承認できません' }, { status: 403 })
  }

  const now = new Date().toISOString()

  if (action === 'request_changes') {
    await supabase.from('review_feedback').update({ status: 'drafting', veteran_checked_by: user.id, veteran_checked_at: now }).eq('id', fb.id)
    return NextResponse.json({ ok: true })
  }

  // approve
  await supabase.from('review_feedback').update({ status: 'published', published_at: now, veteran_checked_by: user.id, veteran_checked_at: now }).eq('id', fb.id)

  // 新任の残り確認件数を1減らす
  const { data: rp } = await supabase.from('reviewer_profiles').select('needs_approval_remaining').eq('user_id', fb.reviewer_id).maybeSingle()
  if (rp && rp.needs_approval_remaining > 0) {
    await supabase.from('reviewer_profiles').update({ needs_approval_remaining: rp.needs_approval_remaining - 1 }).eq('user_id', fb.reviewer_id)
  }

  const svc = await createServiceClient()
  await finalizeReview(supabase, svc, submissionId)
  return NextResponse.json({ ok: true })
}
