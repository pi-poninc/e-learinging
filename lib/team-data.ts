/**
 * チーム進捗・社員別カルテ用のデータ集計（service client 前提。呼び出し側で権限確認すること）
 */
import type { SupabaseClient } from '@supabase/supabase-js'

type SC = SupabaseClient

function pct(done: number, total: number) {
  return total > 0 ? Math.round((done / total) * 100) : 0
}

/** course_id -> 公開レッスンID集合 を作る */
async function buildCourseLessons(svc: SC): Promise<Map<string, Set<string>>> {
  const [{ data: sections }, { data: lessons }] = await Promise.all([
    svc.from('sections').select('id, course_id'),
    svc.from('lessons').select('id, section_id').eq('status', 'published'),
  ])
  const sectionCourse = new Map<string, string>()
  for (const s of sections || []) sectionCourse.set(s.id, s.course_id)
  const courseLessons = new Map<string, Set<string>>()
  for (const l of lessons || []) {
    const cid = sectionCourse.get(l.section_id)
    if (!cid) continue
    if (!courseLessons.has(cid)) courseLessons.set(cid, new Set())
    courseLessons.get(cid)!.add(l.id)
  }
  return courseLessons
}

export interface TeamMember {
  id: string
  name: string
  groupLabel: string
  assigned: number
  completed: number
  avgProgress: number
  notStarted: boolean // 1つも着手していない
}

/** チーム一覧サマリー。scopeGroupId を渡すとその部署の受講者だけ（null=全員） */
export async function getTeamMembers(svc: SC, scopeGroupId: string | null): Promise<TeamMember[]> {
  let q = svc.from('profiles').select('id, name, group_id').eq('role', 'student')
  if (scopeGroupId) q = q.eq('group_id', scopeGroupId)
  const [{ data: members }, { data: groups }, courseLessons] = await Promise.all([
    q, svc.from('groups').select('id, name'), buildCourseLessons(svc),
  ])
  const gname = new Map<string, string>()
  for (const g of groups || []) gname.set(g.id, g.name)

  const userIds = (members || []).map((m) => m.id)
  const [{ data: enrollments }, { data: progress }] = await Promise.all([
    svc.from('enrollments').select('user_id, course_id, status').in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']),
    svc.from('lesson_progress').select('user_id, lesson_id').eq('completed', true).in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']),
  ])
  const doneByUser = new Map<string, Set<string>>()
  for (const p of progress || []) {
    if (!doneByUser.has(p.user_id)) doneByUser.set(p.user_id, new Set())
    doneByUser.get(p.user_id)!.add(p.lesson_id)
  }
  const enrByUser = new Map<string, { course_id: string; status: string }[]>()
  for (const e of enrollments || []) {
    if (!enrByUser.has(e.user_id)) enrByUser.set(e.user_id, [])
    enrByUser.get(e.user_id)!.push({ course_id: e.course_id, status: e.status })
  }

  return (members || []).map((m) => {
    const enrs = enrByUser.get(m.id) || []
    const done = doneByUser.get(m.id) || new Set<string>()
    let sumPct = 0, anyProgress = 0
    for (const e of enrs) {
      const lessons = courseLessons.get(e.course_id) || new Set<string>()
      let c = 0
      for (const lid of lessons) if (done.has(lid)) c++
      const p = e.status === 'completed' ? 100 : pct(c, lessons.size)
      sumPct += p
      anyProgress += c
    }
    return {
      id: m.id,
      name: m.name || m.id,
      groupLabel: m.group_id ? (gname.get(m.group_id) || '—') : '未所属',
      assigned: enrs.length,
      completed: enrs.filter((e) => e.status === 'completed').length,
      avgProgress: enrs.length ? Math.round(sumPct / enrs.length) : 0,
      notStarted: enrs.length > 0 && anyProgress === 0,
    }
  })
}

export interface CourseRecord {
  courseTitle: string
  status: string
  progress: number
  watchedMinutes: number
  bestScore: number | null
  dueDate: string | null
}
export interface UserRecord {
  profile: { id: string; name: string; role: string; groupLabel: string }
  courses: CourseRecord[]
  totalMinutes: number
  certificates: { number: string; courseTitle: string; issuedAt: string }[]
}

/** 社員1人の学習カルテ */
export async function getUserRecord(svc: SC, userId: string): Promise<UserRecord | null> {
  const { data: profile } = await svc.from('profiles').select('id, name, role, group_id').eq('id', userId).maybeSingle()
  if (!profile) return null
  let groupLabel = '未所属'
  if (profile.group_id) {
    const { data: g } = await svc.from('groups').select('name').eq('id', profile.group_id).maybeSingle()
    groupLabel = g?.name || '—'
  }

  const [courseLessons, { data: sections }, { data: enrollments }, { data: progress }, { data: attempts }, { data: certs }] = await Promise.all([
    buildCourseLessons(svc),
    svc.from('sections').select('id, course_id'),
    svc.from('enrollments').select('status, due_date, course:courses(id, title)').eq('user_id', userId),
    svc.from('lesson_progress').select('lesson_id, watched_seconds').eq('user_id', userId),
    svc.from('quiz_attempts').select('score, quiz:quizzes(section_id)').eq('user_id', userId),
    svc.from('certificates').select('certificate_number, issued_at, course:courses(title)').eq('user_id', userId),
  ])

  // section_id -> course_id、テスト最高点を講座別に集計
  const sectionCourse = new Map<string, string>()
  for (const s of sections || []) sectionCourse.set(s.id, s.course_id)
  const bestByCourse = new Map<string, number>()
  for (const a of attempts || []) {
    const sid = (a.quiz as unknown as { section_id: string } | null)?.section_id
    const cid = sid ? sectionCourse.get(sid) : undefined
    const score = a.score as number
    if (!cid || typeof score !== 'number') continue
    bestByCourse.set(cid, Math.max(bestByCourse.get(cid) ?? 0, score))
  }

  const doneLessons = new Set<string>()
  const watchedByLesson = new Map<string, number>()
  for (const p of progress || []) {
    watchedByLesson.set(p.lesson_id, p.watched_seconds || 0)
  }
  // 完了レッスンは completed=true のみ数えたいので別取得
  const { data: doneRows } = await svc.from('lesson_progress').select('lesson_id').eq('user_id', userId).eq('completed', true)
  for (const d of doneRows || []) doneLessons.add(d.lesson_id)

  let totalSeconds = 0
  for (const s of watchedByLesson.values()) totalSeconds += s

  const courses: CourseRecord[] = []
  for (const e of enrollments || []) {
    const course = e.course as unknown as { id: string; title: string } | null
    if (!course) continue
    const lessons = courseLessons.get(course.id) || new Set<string>()
    let c = 0, secs = 0
    for (const lid of lessons) {
      if (doneLessons.has(lid)) c++
      secs += watchedByLesson.get(lid) || 0
    }
    courses.push({
      courseTitle: course.title,
      status: e.status === 'completed' ? '修了' : e.status === 'active' ? '受講中' : '停止',
      progress: e.status === 'completed' ? 100 : pct(c, lessons.size),
      watchedMinutes: Math.round(secs / 60),
      bestScore: bestByCourse.has(course.id) ? bestByCourse.get(course.id)! : null,
      dueDate: (e.due_date as string) || null,
    })
  }

  return {
    profile: { id: profile.id, name: profile.name || profile.id, role: profile.role, groupLabel },
    courses,
    totalMinutes: Math.round(totalSeconds / 60),
    certificates: (certs || []).map((c) => ({
      number: c.certificate_number as string,
      courseTitle: (c.course as unknown as { title: string } | null)?.title || '—',
      issuedAt: (c.issued_at as string || '').slice(0, 10),
    })),
  }
}
