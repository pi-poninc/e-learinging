/**
 * 受講者の学習サマリ（レベル・王道進捗・次の一歩・おすすめ講座）を計算する。
 * /api/recommendations と 週次ダイジェストCron の両方から使う共通処理。
 * サーバ専用（service client を渡す）。
 */
import { recommendNextCourses, type PathLite, type CompletionMap } from '@/lib/recommend-courses'
import { computeLevel } from '@/lib/fde-level'

// service client の型は supabase-js 依存なので緩く受ける
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Svc = any

export interface CourseRecoOut {
  courseId: string
  title: string
  reason: string
  pathTitle: string
  url: string
}
export interface LearnerSummary {
  name: string | null
  level: { level: number; title: string; xp: number }
  masterPath: null | { title: string; overallPct: number; nextCourse: { courseId: string; title: string; url: string } | null }
  recommendations: CourseRecoOut[]
}

export async function computeLearnerSummary(
  svc: Svc,
  userId: string,
  appUrl: string,
  limit = 3,
): Promise<LearnerSummary> {
  // --- 完了データ ---
  const [pr, qa, ca, as_] = await Promise.all([
    svc.from('lesson_progress').select('lesson_id').eq('user_id', userId).eq('completed', true),
    svc.from('quiz_attempts').select('quiz_id').eq('user_id', userId).eq('passed', true),
    svc.from('case_attempts').select('case_simulation_id').eq('user_id', userId).eq('completed', true),
    svc.from('assignment_submissions').select('assignment_id').eq('user_id', userId).eq('status', 'approved'),
  ])
  const doneL = new Set((pr.data || []).map((r: { lesson_id: string }) => r.lesson_id))
  const doneQ = new Set((qa.data || []).map((r: { quiz_id: string }) => r.quiz_id))
  const doneC = new Set((ca.data || []).map((r: { case_simulation_id: string }) => r.case_simulation_id))
  const doneA = new Set((as_.data || []).map((r: { assignment_id: string }) => r.assignment_id))

  // --- パス＋項目 ---
  const { data: paths } = await svc.from('learning_paths').select('id, title').eq('status', 'published').order('sort_order')
  const pathIds = (paths || []).map((p: { id: string }) => p.id)
  const { data: items } = pathIds.length
    ? await svc.from('path_items').select('path_id, course_id, sort_order, milestone_label, course:courses(id, title, status)').in('path_id', pathIds)
    : { data: [] }

  const titleById: Record<string, string> = {}
  const publishedCourse = new Set<string>()
  for (const it of items || []) {
    const c = it.course as { id: string; title: string; status: string } | null
    if (c) {
      titleById[it.course_id] = c.title
      if (c.status === 'published') publishedCourse.add(it.course_id)
    }
  }

  // --- 対象講座の完了率 ---
  const courseIds = Array.from(new Set((items || []).map((it: { course_id: string }) => it.course_id))) as string[]
  const completion: CompletionMap = {}
  courseIds.forEach((c) => (completion[c] = { total: 0, done: 0 }))
  if (courseIds.length) {
    const { data: sections } = await svc.from('sections').select('id, course_id').in('course_id', courseIds)
    const secToCourse = new Map((sections || []).map((s: { id: string; course_id: string }) => [s.id, s.course_id]))
    const secIds = (sections || []).map((s: { id: string }) => s.id)
    if (secIds.length) {
      const [ls, qs, as2, cs] = await Promise.all([
        svc.from('lessons').select('id, section_id').eq('status', 'published').in('section_id', secIds),
        svc.from('quizzes').select('id, section_id').eq('status', 'published').in('section_id', secIds),
        svc.from('assignments').select('id, section_id').eq('status', 'published').in('section_id', secIds),
        svc.from('case_simulations').select('id, section_id').eq('status', 'published').in('section_id', secIds),
      ])
      const bump = (secId: string, done: boolean) => {
        const cid = secToCourse.get(secId) as string | undefined; if (!cid) return
        const cp = completion[cid]; if (!cp) return
        cp.total += 1; if (done) cp.done += 1
      }
      for (const l of ls.data || []) bump(l.section_id, doneL.has(l.id))
      for (const q of qs.data || []) bump(q.section_id, doneQ.has(q.id))
      for (const a of as2.data || []) bump(a.section_id, doneA.has(a.id))
      for (const c of cs.data || []) bump(c.section_id, doneC.has(c.id))
    }
  }

  const pathsLite: PathLite[] = (paths || []).map((p: { id: string; title: string }) => ({
    id: p.id, title: p.title,
    items: (items || [])
      .filter((it: { path_id: string; course_id: string }) => it.path_id === p.id && publishedCourse.has(it.course_id))
      .map((it: { course_id: string; sort_order: number; milestone_label: string | null }) => ({ courseId: it.course_id, sortOrder: it.sort_order, milestone: it.milestone_label })),
  }))

  const recos = recommendNextCourses(pathsLite, completion, titleById, limit)

  const { data: prof } = await svc.from('profiles').select('name').eq('id', userId).maybeSingle()
  const level = computeLevel({ lessons: doneL.size, quizzes: doneQ.size, cases: doneC.size, assignments: doneA.size })

  const master = pathsLite.find((p) => p.title.startsWith('pipon流の働き方'))
  let masterPath: LearnerSummary['masterPath'] = null
  if (master) {
    let tot = 0, dn = 0
    for (const it of master.items) {
      const cp = completion[it.courseId]; if (!cp) continue
      tot += cp.total; dn += cp.done
    }
    const ordered = [...master.items].sort((a, b) => a.sortOrder - b.sortOrder)
    const firstIncomplete = ordered.find((it) => {
      const cp = completion[it.courseId]
      return !(cp && cp.total > 0 && cp.done >= cp.total)
    })
    masterPath = {
      title: master.title.replace('【まずここから】', ''),
      overallPct: tot ? Math.round((dn / tot) * 100) : 0,
      nextCourse: firstIncomplete
        ? { courseId: firstIncomplete.courseId, title: titleById[firstIncomplete.courseId] || '(講座)', url: `${appUrl}/courses/${firstIncomplete.courseId}` }
        : null,
    }
  }

  return {
    name: prof?.name || null,
    level: { level: level.level, title: level.title, xp: level.xp },
    masterPath,
    recommendations: recos.map((r) => ({
      courseId: r.courseId, title: r.title, reason: r.reason, pathTitle: r.pathTitle,
      url: `${appUrl}/courses/${r.courseId}`,
    })),
  }
}
