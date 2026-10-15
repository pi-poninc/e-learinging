import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { submissionReviewEnabled } from '@/lib/flags'
import { STAFF_ROLES } from '@/lib/review/service'
import { finalizeReview } from '@/lib/review/finalize'

export async function POST(request: NextRequest) {
  if (!submissionReviewEnabled()) return NextResponse.json({ error: '機能が無効です' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { submissionId, goodPoints, improvements, nextAction, rubricScores } = await request.json()
  if (!submissionId) return NextResponse.json({ error: 'submissionId が必要です' }, { status: 400 })
  if (!goodPoints || !nextAction) {
    return NextResponse.json({ error: '「良かった点」と「次にやること」は必須です' }, { status: 400 })
  }

  const { data: fb } = await supabase
    .from('review_feedback').select('id, claimed_at').eq('submission_id', submissionId).maybeSingle()
  if (!fb) return NextResponse.json({ error: 'まず担当（確保）してください' }, { status: 400 })

  // 新任添削者（needs_approval_remaining>0）は、公開前にベテラン確認が必要
  const { data: rp } = await supabase.from('reviewer_profiles').select('needs_approval_remaining').eq('user_id', user.id).maybeSingle()
  const newReviewer = (rp?.needs_approval_remaining ?? 0) > 0
  const finalStatus = newReviewer ? 'pending_approval' : 'published'

  const now = new Date()
  const dur = Math.max(0, Math.round((now.getTime() - new Date(fb.claimed_at).getTime()) / 1000))

  const { error } = await supabase
    .from('review_feedback')
    .update({
      status: finalStatus,
      good_points: goodPoints,
      improvements: improvements || null,
      next_action: nextAction,
      rubric_scores: rubricScores && typeof rubricScores === 'object' ? rubricScores : {},
      published_at: newReviewer ? null : now.toISOString(),
      review_duration_seconds: dur,
    })
    .eq('id', fb.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (newReviewer) {
    // 提出は in_review のまま。ベテラン承認で確定する
    return NextResponse.json({ ok: true, pendingApproval: true })
  }

  const svc = await createServiceClient()
  await finalizeReview(supabase, svc, submissionId)
  return NextResponse.json({ ok: true })
}
