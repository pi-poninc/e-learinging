/**
 * 企業（組織）ダッシュボードの集計（サーバー側・サービスロール）。
 * org_admin は自社の受講者だけ。提出物の中身・AIコーチ会話は含めない（契約設定で別途・既定非表示）。
 */
import { learningDay, weekStartOf } from '@/lib/learning-day'

export interface OrgLearnerRow {
  userId: string
  name: string
  weekDays: number        // 今週の提出日数
  activeLast7: boolean    // 直近7日に提出あり
  gradeLevel: number      // 承認済みグレードの最高段階
  certs: number           // 取得認定数
}
export interface OrgOverview {
  learnerCount: number
  submittedThisWeek: number   // 今週提出した人数
  weekSubmissionTotal: number
  rows: OrgLearnerRow[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function computeOrgOverview(svc: any, orgId: string): Promise<OrgOverview> {
  const { data: members } = await svc.from('organization_members').select('user_id').eq('organization_id', orgId).eq('role', 'learner')
  const ids: string[] = (members || []).map((m: { user_id: string }) => m.user_id)
  if (!ids.length) return { learnerCount: 0, submittedThisWeek: 0, weekSubmissionTotal: 0, rows: [] }

  const names = new Map<string, string>()
  const { data: profs } = await svc.from('profiles').select('id, name').in('id', ids)
  for (const p of profs || []) names.set(p.id, p.name || '受講者')

  const today = learningDay(new Date())
  const weekStartDay = weekStartOf(today, 'monday')
  const sevenAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

  const { data: weekSubs } = await svc.from('review_submissions')
    .select('user_id, learning_day').in('user_id', ids).neq('status', 'draft').gte('learning_day', weekStartDay)
  const daysByUser = new Map<string, Set<string>>()
  for (const s of weekSubs || []) {
    const set = daysByUser.get(s.user_id) || new Set<string>()
    if (s.learning_day) set.add(s.learning_day)
    daysByUser.set(s.user_id, set)
  }

  const { data: recent } = await svc.from('review_submissions')
    .select('user_id').in('user_id', ids).neq('status', 'draft').gte('submitted_at', sevenAgo)
  const active = new Set((recent || []).map((r: { user_id: string }) => r.user_id))

  const { data: grades } = await svc.from('grades').select('id, level')
  const gradeLevel = new Map<string, number>((grades || []).map((g: { id: string; level: number }) => [g.id, g.level]))
  const { data: ug } = await svc.from('user_grades').select('user_id, grade_id').eq('status', 'approved').in('user_id', ids)
  const maxGrade = new Map<string, number>()
  for (const g of ug || []) maxGrade.set(g.user_id, Math.max(maxGrade.get(g.user_id) || 0, gradeLevel.get(g.grade_id) || 0))

  const { data: uc } = await svc.from('user_certifications').select('user_id').eq('status', 'approved').in('user_id', ids)
  const certCount = new Map<string, number>()
  for (const c of uc || []) certCount.set(c.user_id, (certCount.get(c.user_id) || 0) + 1)

  const rows: OrgLearnerRow[] = ids.map((uid) => ({
    userId: uid, name: names.get(uid) || '受講者',
    weekDays: daysByUser.get(uid)?.size || 0,
    activeLast7: active.has(uid),
    gradeLevel: maxGrade.get(uid) || 0,
    certs: certCount.get(uid) || 0,
  })).sort((a, b) => a.name.localeCompare(b.name))

  return {
    learnerCount: ids.length,
    submittedThisWeek: [...daysByUser.values()].filter((s) => s.size > 0).length,
    weekSubmissionTotal: (weekSubs || []).length,
    rows,
  }
}
