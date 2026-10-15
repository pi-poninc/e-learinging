/**
 * コホートの集計（サーバー側・サービスロールで読む）。
 * 原則G1: 個人の順位は作らない。出すのは「全体の週目標達成率」と「今週の提出数の合計」、
 * そして仲間の提出タイムライン（本人が共有ONのものだけ・内容は出さない）。
 */
import { learningDay, weekStartOf } from '@/lib/learning-day'

export interface CohortOverview {
  memberCount: number
  weekGoalRate: number        // 週目標を達成した人の割合(%)
  weekSubmissionTotal: number // 今週の提出数の合計
  timeline: { submissionId: string; name: string; taskTitle: string; submittedAt: string; cheers: number; cheeredByMe: boolean }[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function computeCohortOverview(
  svc: any, cohortId: string, viewerId: string, weeklyGoalDays: number, weekStart: 'monday' | 'sunday',
): Promise<CohortOverview> {
  const { data: members } = await svc.from('cohort_members').select('user_id, share_activity').eq('cohort_id', cohortId)
  const memberIds: string[] = (members || []).map((m: { user_id: string }) => m.user_id)
  const sharingIds = new Set((members || []).filter((m: { share_activity: boolean }) => m.share_activity).map((m: { user_id: string }) => m.user_id))
  if (memberIds.length === 0) return { memberCount: 0, weekGoalRate: 0, weekSubmissionTotal: 0, timeline: [] }

  const today = learningDay(new Date())
  const weekStartDay = weekStartOf(today, weekStart)

  // 今週の提出（下書き以外）
  const { data: weekSubs } = await svc.from('review_submissions')
    .select('user_id, learning_day').in('user_id', memberIds).neq('status', 'draft').gte('learning_day', weekStartDay)
  const daysByUser = new Map<string, Set<string>>()
  for (const s of weekSubs || []) {
    const set = daysByUser.get(s.user_id) || new Set<string>()
    if (s.learning_day) set.add(s.learning_day)
    daysByUser.set(s.user_id, set)
  }
  let achieved = 0
  for (const uid of memberIds) if ((daysByUser.get(uid)?.size || 0) >= weeklyGoalDays) achieved += 1
  const weekGoalRate = Math.round((achieved / memberIds.length) * 100)
  const weekSubmissionTotal = (weekSubs || []).length

  // タイムライン（共有ONのメンバーの最近の提出。内容は出さない）
  const shareList = memberIds.filter((id) => sharingIds.has(id))
  let timeline: CohortOverview['timeline'] = []
  if (shareList.length) {
    const { data: recent } = await svc.from('review_submissions')
      .select('id, user_id, submitted_at, task:review_tasks(title)')
      .in('user_id', shareList).neq('status', 'draft').order('submitted_at', { ascending: false }).limit(20)
    const names = new Map<string, string>()
    const { data: profs } = await svc.from('profiles').select('id, name').in('id', shareList)
    for (const p of profs || []) names.set(p.id, p.name || '仲間')
    const subIds = (recent || []).map((r: { id: string }) => r.id)
    const cheerCount = new Map<string, number>()
    const cheeredByMe = new Set<string>()
    if (subIds.length) {
      const { data: cheers } = await svc.from('submission_cheers').select('submission_id, user_id').in('submission_id', subIds)
      for (const c of cheers || []) {
        cheerCount.set(c.submission_id, (cheerCount.get(c.submission_id) || 0) + 1)
        if (c.user_id === viewerId) cheeredByMe.add(c.submission_id)
      }
    }
    timeline = (recent || []).map((r: { id: string; user_id: string; submitted_at: string; task: { title: string } | null }) => ({
      submissionId: r.id,
      name: names.get(r.user_id) || '仲間',
      taskTitle: (r.task as { title: string } | null)?.title || '課題',
      submittedAt: r.submitted_at,
      cheers: cheerCount.get(r.id) || 0,
      cheeredByMe: cheeredByMe.has(r.id),
    }))
  }

  return { memberCount: memberIds.length, weekGoalRate, weekSubmissionTotal, timeline }
}
