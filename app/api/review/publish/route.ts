import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { submissionReviewEnabled, skillMapEnabled } from '@/lib/flags'
import { STAFF_ROLES } from '@/lib/review/service'
import { sendEmail } from '@/lib/mail'
import { applyReviewSkillAssessments } from '@/lib/review/recompute'

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
    .from('review_feedback')
    .select('id, claimed_at')
    .eq('submission_id', submissionId)
    .maybeSingle()
  if (!fb) return NextResponse.json({ error: 'まず担当（確保）してください' }, { status: 400 })

  const now = new Date()
  const dur = Math.max(0, Math.round((now.getTime() - new Date(fb.claimed_at).getTime()) / 1000))

  const { error } = await supabase
    .from('review_feedback')
    .update({
      status: 'published',
      good_points: goodPoints,
      improvements: improvements || null,
      next_action: nextAction,
      rubric_scores: rubricScores && typeof rubricScores === 'object' ? rubricScores : {},
      published_at: now.toISOString(),
      review_duration_seconds: dur,
    })
    .eq('id', fb.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('review_submissions').update({ status: 'reviewed' }).eq('id', submissionId)

  // スキルマップが有効なら、ルーブリック評価をスキル評価へ反映（公開自体は止めない）
  if (skillMapEnabled()) {
    try {
      await applyReviewSkillAssessments(supabase, {
        submissionId,
        reviewerId: user.id,
        rubricScores: rubricScores && typeof rubricScores === 'object' ? rubricScores : undefined,
      })
    } catch {
      // 反映失敗は公開を失敗させない
    }
  }

  // 受講者へメール通知（送信基盤が無い環境では送らずに成功を返す）
  try {
    const { data: sub } = await supabase
      .from('review_submissions')
      .select('user_id, task_id')
      .eq('id', submissionId)
      .maybeSingle()
    if (sub) {
      const { data: task } = await supabase.from('review_tasks').select('title').eq('id', sub.task_id).maybeSingle()
      const svc = await createServiceClient()
      const { data: u } = await svc.auth.admin.getUserById(sub.user_id)
      const email = u?.user?.email
      if (email) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
        await sendEmail({
          to: email,
          subject: `添削が返ってきました：${task?.title || '課題'}`,
          text: `あなたの提出に添削が返りました。\n${appUrl}/practice/${sub.task_id} で確認できます。`,
        })
      }
    }
  } catch {
    // 通知失敗は添削公開自体を失敗させない
  }

  return NextResponse.json({ ok: true })
}
