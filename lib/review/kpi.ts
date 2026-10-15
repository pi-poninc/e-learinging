/**
 * KPI 集計（サーバー側・サービスロール）。既存データから算出できるものに絞る。
 * 返却時間・SLA・初期提出・週学習日数・継続・ケース通過・時間内提出・ピア・グレード/認定・コホート。
 */
import { learningDay, weekStartOf } from '@/lib/learning-day'

export interface CourseKpi {
  learners: number
  early: { dist: { label: string; n: number }[]; thresholdRate: number }     // 初期7日の提出回数分布・5回以上率
  weekDays: { label: string; n: number }[]                                   // 今週の提出日数分布 0..7
  retentionLast7: number                                                     // 直近7日に提出した割合(%)
  slaRate: number | null                                                     // SLA達成率(%)
  avgReturnHours: number | null                                              // 平均返却時間(h)
  avgReviewMinutes: number | null                                            // 添削1件の平均作業時間(分)
  caseClearRate: number | null                                               // ケース課題の通過率(%)
  timedInTimeRate: number | null                                             // 時間制限課題の時間内提出率(%)
  peerReviews: number
  gradedUsers: number
  certifiedUsers: number
  cohortMembers: number
  demoEntries: number
  avgAiRewriteRate: number | null   // AI下書きからの平均書き換え率(%)
}

const EARLY_WINDOW_DAYS = 7
const EARLY_THRESHOLD = 5

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function computeCourseKpi(svc: any, courseId: string): Promise<CourseKpi> {
  const { data: enr } = await svc.from('enrollments').select('user_id, created_at').eq('course_id', courseId).eq('status', 'active')
  const ids: string[] = (enr || []).map((e: { user_id: string }) => e.user_id)
  const startBy = new Map<string, number>((enr || []).map((e: { user_id: string; created_at: string }) => [e.user_id, new Date(e.created_at).getTime()]))
  const learners = ids.length
  const empty: CourseKpi = {
    learners, early: { dist: [], thresholdRate: 0 }, weekDays: [], retentionLast7: 0,
    slaRate: null, avgReturnHours: null, avgReviewMinutes: null, caseClearRate: null, timedInTimeRate: null,
    peerReviews: 0, gradedUsers: 0, certifiedUsers: 0, cohortMembers: 0, demoEntries: 0, avgAiRewriteRate: null,
  }
  if (!learners) return empty

  const { data: subs } = await svc.from('review_submissions')
    .select('user_id, submitted_at, learning_day, status, auto_check_result, task:review_tasks(assignment_type)')
    .eq('course_id', courseId).neq('status', 'draft')

  const now = Date.now()
  const weekStartDay = weekStartOf(learningDay(new Date()), 'monday')
  const sevenAgo = now - 7 * 24 * 3600 * 1000

  const earlyCount = new Map<string, number>()
  const weekDaySet = new Map<string, Set<string>>()
  const activeLast7 = new Set<string>()
  // ケース / 時間制限
  const caseSubmitters = new Set<string>(); const caseCleared = new Set<string>()
  let timedTotal = 0, timedInTime = 0

  for (const s of subs || []) {
    const st = s.submitted_at ? new Date(s.submitted_at).getTime() : 0
    const start = startBy.get(s.user_id)
    if (start != null && st && st - start <= EARLY_WINDOW_DAYS * 24 * 3600 * 1000) {
      earlyCount.set(s.user_id, (earlyCount.get(s.user_id) || 0) + 1)
    }
    if (s.learning_day && s.learning_day >= weekStartDay) {
      const set = weekDaySet.get(s.user_id) || new Set<string>(); set.add(s.learning_day); weekDaySet.set(s.user_id, set)
    }
    if (st >= sevenAgo) activeLast7.add(s.user_id)
    const atype = (s.task as unknown as { assignment_type: string } | null)?.assignment_type
    if (atype === 'case') { caseSubmitters.add(s.user_id); if (s.status === 'reviewed') caseCleared.add(s.user_id) }
    if (atype === 'timed_challenge') { timedTotal += 1; if (!(s.auto_check_result as { overtime?: boolean })?.overtime) timedInTime += 1 }
  }

  // 初期提出の分布
  let thresholdMet = 0
  const buckets = { '0回': 0, '1-4回': 0, '5回以上': 0 }
  for (const uid of ids) {
    const c = earlyCount.get(uid) || 0
    if (c === 0) buckets['0回'] += 1
    else if (c < EARLY_THRESHOLD) buckets['1-4回'] += 1
    else { buckets['5回以上'] += 1; thresholdMet += 1 }
  }
  const early = { dist: Object.entries(buckets).map(([label, n]) => ({ label, n })), thresholdRate: Math.round((thresholdMet / learners) * 100) }

  // 週の提出日数分布
  const wd = new Array(8).fill(0)
  for (const uid of ids) wd[Math.min(7, weekDaySet.get(uid)?.size || 0)] += 1
  const weekDays = wd.map((n, i) => ({ label: `${i}日`, n }))

  const retentionLast7 = Math.round((activeLast7.size / learners) * 100)

  // SLA / 返却時間 / 作業時間
  const { data: fbs } = await svc.from('review_feedback')
    .select('published_at, review_duration_seconds, ai_rewrite_rate, submission:review_submissions(submitted_at, sla_due_at, course_id)').eq('status', 'published')
  let slaMet = 0, slaTotal = 0, retSum = 0, retN = 0, durSum = 0, durN = 0, rwSum = 0, rwN = 0
  for (const f of fbs || []) {
    const sub = f.submission as unknown as { submitted_at: string | null; sla_due_at: string | null; course_id: string } | null
    if (!sub || sub.course_id !== courseId || !f.published_at) continue
    if (sub.sla_due_at) { slaTotal += 1; if (new Date(f.published_at).getTime() <= new Date(sub.sla_due_at).getTime()) slaMet += 1 }
    if (sub.submitted_at) { retSum += (new Date(f.published_at).getTime() - new Date(sub.submitted_at).getTime()); retN += 1 }
    if (f.review_duration_seconds != null) { durSum += f.review_duration_seconds; durN += 1 }
    if (f.ai_rewrite_rate != null) { rwSum += f.ai_rewrite_rate; rwN += 1 }
  }

  // ピアレビュー（このコースの提出に対して）
  const { data: peers } = await svc.from('peer_reviews').select('submission:review_submissions(course_id)').eq('status', 'submitted')
  const peerReviews = (peers || []).filter((p: { submission: { course_id: string } | null }) => (p.submission as { course_id: string } | null)?.course_id === courseId).length

  // グレード・認定
  const { data: grades } = await svc.from('grades').select('id').eq('course_id', courseId)
  const gradeIds = (grades || []).map((g: { id: string }) => g.id)
  let gradedUsers = 0
  if (gradeIds.length) {
    const { data: ug } = await svc.from('user_grades').select('user_id').eq('status', 'approved').in('grade_id', gradeIds)
    gradedUsers = new Set((ug || []).map((u: { user_id: string }) => u.user_id)).size
  }
  const { data: certs } = await svc.from('certifications').select('id').eq('course_id', courseId)
  const certIds = (certs || []).map((c: { id: string }) => c.id)
  let certifiedUsers = 0
  if (certIds.length) {
    const { data: uc } = await svc.from('user_certifications').select('user_id').eq('status', 'approved').in('certification_id', certIds)
    certifiedUsers = new Set((uc || []).map((u: { user_id: string }) => u.user_id)).size
  }

  // コホート・デモデイ
  const { data: cohorts } = await svc.from('cohorts').select('id').eq('course_id', courseId)
  const cohortIds = (cohorts || []).map((c: { id: string }) => c.id)
  let cohortMembers = 0, demoEntries = 0
  if (cohortIds.length) {
    const { count: cm } = await svc.from('cohort_members').select('id', { count: 'exact', head: true }).in('cohort_id', cohortIds)
    cohortMembers = cm || 0
    const { count: de } = await svc.from('demo_day_entries').select('id', { count: 'exact', head: true }).in('cohort_id', cohortIds)
    demoEntries = de || 0
  }

  return {
    learners, early, weekDays, retentionLast7,
    slaRate: slaTotal ? Math.round((slaMet / slaTotal) * 100) : null,
    avgReturnHours: retN ? Math.round((retSum / retN) / 3600000 * 10) / 10 : null,
    avgReviewMinutes: durN ? Math.round((durSum / durN) / 60) : null,
    caseClearRate: caseSubmitters.size ? Math.round((caseCleared.size / caseSubmitters.size) * 100) : null,
    timedInTimeRate: timedTotal ? Math.round((timedInTime / timedTotal) * 100) : null,
    peerReviews, gradedUsers, certifiedUsers, cohortMembers, demoEntries,
    avgAiRewriteRate: rwN ? Math.round((rwSum / rwN) * 100) : null,
  }
}
