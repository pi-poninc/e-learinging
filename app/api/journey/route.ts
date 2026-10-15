import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { computeLevel } from '@/lib/fde-level'
import { skillMapEnabled } from '@/lib/flags'
import { computeGradeLevel } from '@/lib/review/grade'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const uid = user.id

  // ---- 完了データ（ID集合＋件数）----
  const [progRes, quizRes, caseRes, asgRes] = await Promise.all([
    supabase.from('lesson_progress').select('lesson_id').eq('user_id', uid).eq('completed', true),
    supabase.from('quiz_attempts').select('quiz_id').eq('user_id', uid).eq('passed', true),
    supabase.from('case_attempts').select('case_simulation_id').eq('user_id', uid).eq('completed', true),
    supabase.from('assignment_submissions').select('assignment_id').eq('user_id', uid).eq('status', 'approved'),
  ])
  const doneLessons = new Set((progRes.data || []).map((r) => r.lesson_id))
  const donePassedQuiz = new Set((quizRes.data || []).map((r) => r.quiz_id))
  const doneCases = new Set((caseRes.data || []).map((r) => r.case_simulation_id))
  const doneAsg = new Set((asgRes.data || []).map((r) => r.assignment_id))

  // 成長軸は1つに統一：スキルマップが有効なコースでは「グレード」、無ければXP（後方互換）
  const levelInfo = computeLevel({
    lessons: doneLessons.size, quizzes: donePassedQuiz.size,
    cases: doneCases.size, assignments: doneAsg.size,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let level: any = { mode: 'xp', ...levelInfo }
  if (skillMapEnabled()) {
    const g = await computeGradeLevel(supabase, uid)
    if (g) level = g
  }

  // ---- パス ----
  const { data: paths } = await supabase
    .from('learning_paths').select('*').eq('status', 'published').order('sort_order')
  const pathIds = (paths || []).map((p) => p.id)

  const { data: items } = pathIds.length
    ? await supabase.from('path_items')
        .select('id, path_id, course_id, sort_order, target_days, milestone_label, course:courses(id, title)')
        .in('path_id', pathIds).order('sort_order')
    : { data: [] }

  const { data: enrolls } = pathIds.length
    ? await supabase.from('path_enrollments').select('path_id, started_at, status').eq('user_id', uid)
    : { data: [] }
  const enrollMap = new Map((enrolls || []).map((e) => [e.path_id, e]))

  // ---- 対象講座の完了率を一括計算 ----
  const courseIds = Array.from(new Set((items || []).map((it) => it.course_id)))
  const courseProgress = new Map<string, { total: number; done: number }>()
  courseIds.forEach((c) => courseProgress.set(c, { total: 0, done: 0 }))

  if (courseIds.length) {
    const { data: sections } = await supabase
      .from('sections').select('id, course_id').in('course_id', courseIds)
    const secToCourse = new Map((sections || []).map((s) => [s.id, s.course_id]))
    const secIds = (sections || []).map((s) => s.id)

    if (secIds.length) {
      const [ls, qs, as_, cs] = await Promise.all([
        supabase.from('lessons').select('id, section_id').eq('status', 'published').in('section_id', secIds),
        supabase.from('quizzes').select('id, section_id').eq('status', 'published').in('section_id', secIds),
        supabase.from('assignments').select('id, section_id').eq('status', 'published').in('section_id', secIds),
        supabase.from('case_simulations').select('id, section_id').eq('status', 'published').in('section_id', secIds),
      ])
      const bump = (secId: string, isDone: boolean) => {
        const cid = secToCourse.get(secId); if (!cid) return
        const cp = courseProgress.get(cid); if (!cp) return
        cp.total += 1; if (isDone) cp.done += 1
      }
      for (const l of ls.data || []) bump(l.section_id, doneLessons.has(l.id))
      for (const q of qs.data || []) bump(q.section_id, donePassedQuiz.has(q.id))
      for (const a of as_.data || []) bump(a.section_id, doneAsg.has(a.id))
      for (const c of cs.data || []) bump(c.section_id, doneCases.has(c.id))
    }
  }

  const DAY = 24 * 60 * 60 * 1000
  const outPaths = (paths || []).map((p) => {
    const enr = enrollMap.get(p.id)
    const started = enr ? new Date(enr.started_at) : null
    const its = (items || []).filter((it) => it.path_id === p.id)
      .sort((a, b) => a.sort_order - b.sort_order)
    let prevDone = true
    const outItems = its.map((it) => {
      const cp = courseProgress.get(it.course_id) || { total: 0, done: 0 }
      const pct = cp.total ? Math.round((cp.done / cp.total) * 100) : 0
      const done = cp.total > 0 && cp.done >= cp.total
      const course = (it.course as unknown as { id: string; title: string } | null)
      const dueDate = started && it.target_days != null
        ? new Date(started.getTime() + it.target_days * DAY).toISOString() : null
      const isNext = enr != null && !done && prevDone
      if (!done) prevDone = false
      return {
        id: it.id, courseId: it.course_id, title: course?.title || '(講座)',
        milestone: it.milestone_label, targetDays: it.target_days, dueDate,
        total: cp.total, doneCount: cp.done, pct, done, isNext,
      }
    })
    const total = outItems.reduce((s, i) => s + i.total, 0)
    const done = outItems.reduce((s, i) => s + i.doneCount, 0)
    return {
      id: p.id, title: p.title, description: p.description,
      enrolled: enr != null, startedAt: enr ? enr.started_at : null,
      overallPct: total ? Math.round((done / total) * 100) : 0,
      items: outItems,
    }
  })

  return NextResponse.json({ level, paths: outPaths })
}
