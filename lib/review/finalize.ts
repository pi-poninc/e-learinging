/**
 * 添削が「公開」確定したときの後処理（提出をreviewed化・スキル反映・受講者へメール）。
 * 通常の添削者はpublish時に、新任(ベテラン確認対象)はベテラン承認時に呼ぶ。
 */
import { skillMapEnabled } from '@/lib/flags'
import { applyReviewSkillAssessments } from './recompute'
import { sendEmail } from '@/lib/mail'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function finalizeReview(supabase: any, serviceClient: any, submissionId: string): Promise<void> {
  await supabase.from('review_submissions').update({ status: 'reviewed' }).eq('id', submissionId)

  if (skillMapEnabled()) {
    try {
      const { data: fb } = await supabase.from('review_feedback').select('reviewer_id').eq('submission_id', submissionId).maybeSingle()
      if (fb) await applyReviewSkillAssessments(supabase, { submissionId, reviewerId: fb.reviewer_id })
    } catch { /* 反映失敗は確定を止めない */ }
  }

  try {
    const { data: sub } = await supabase.from('review_submissions').select('user_id, task_id').eq('id', submissionId).maybeSingle()
    if (sub) {
      const { data: task } = await supabase.from('review_tasks').select('title').eq('id', sub.task_id).maybeSingle()
      const { data: u } = await serviceClient.auth.admin.getUserById(sub.user_id)
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
  } catch { /* 通知失敗は確定を止めない */ }
}
