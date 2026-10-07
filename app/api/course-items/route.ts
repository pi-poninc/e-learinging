import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { CourseItem } from '@/lib/db'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const courseId = request.nextUrl.searchParams.get('courseId')
  if (!courseId) return NextResponse.json({ error: 'Missing courseId' }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdminUser = profile && ['admin', 'instructor'].includes(profile.role)

  // Get course info
  const { data: course } = await supabase
    .from('courses')
    .select('is_sequential')
    .eq('id', courseId)
    .single()

  // Get all sections
  const { data: sections } = await supabase
    .from('sections')
    .select('id')
    .eq('course_id', courseId)
    .order('sort_order')

  const sectionIds = (sections || []).map((s) => s.id)
  if (sectionIds.length === 0) {
    return NextResponse.json({ items: [], isSequential: course?.is_sequential || false })
  }

  // Fetch lessons, quizzes, assignments, case simulations in parallel
  const [lessonsRes, quizzesRes, assignmentsRes, casesRes] = await Promise.all([
    supabase.from('lessons').select('id, title, sort_order, section_id, status')
      .in('section_id', sectionIds),
    supabase.from('quizzes').select('id, title, sort_order, section_id, status')
      .in('section_id', sectionIds),
    supabase.from('assignments').select('id, title, sort_order, section_id, status')
      .in('section_id', sectionIds),
    supabase.from('case_simulations').select('id, title, sort_order, section_id, status')
      .in('section_id', sectionIds),
  ])

  // Fetch user completion data
  const lessonIds = (lessonsRes.data || []).map((l) => l.id)
  const quizIds = (quizzesRes.data || []).map((q) => q.id)
  const assignmentIds = (assignmentsRes.data || []).map((a) => a.id)
  const caseIds = (casesRes.data || []).map((c) => c.id)

  const [progressRes, attemptsRes, submissionsRes, caseAttemptsRes] = await Promise.all([
    lessonIds.length > 0
      ? supabase.from('lesson_progress').select('lesson_id, completed')
          .eq('user_id', user.id).in('lesson_id', lessonIds)
      : { data: [] },
    quizIds.length > 0
      ? supabase.from('quiz_attempts').select('quiz_id, passed')
          .eq('user_id', user.id).in('quiz_id', quizIds)
      : { data: [] },
    assignmentIds.length > 0
      ? supabase.from('assignment_submissions').select('assignment_id, status')
          .eq('user_id', user.id).in('assignment_id', assignmentIds)
      : { data: [] },
    caseIds.length > 0
      ? supabase.from('case_attempts').select('case_simulation_id, completed')
          .eq('user_id', user.id).in('case_simulation_id', caseIds)
      : { data: [] },
  ])

  const completedLessons = new Set(
    (progressRes.data || []).filter((p) => p.completed).map((p) => p.lesson_id)
  )
  const passedQuizzes = new Set(
    (attemptsRes.data || []).filter((a) => a.passed).map((a) => a.quiz_id)
  )
  const approvedAssignments = new Set(
    (submissionsRes.data || []).filter((s) => s.status === 'approved').map((s) => s.assignment_id)
  )
  const completedCases = new Set(
    (caseAttemptsRes.data || []).filter((a) => a.completed).map((a) => a.case_simulation_id)
  )

  // Build unified items list
  const items: CourseItem[] = []

  for (const lesson of lessonsRes.data || []) {
    if (!isAdminUser && lesson.status !== 'published') continue
    items.push({
      id: lesson.id,
      type: 'lesson',
      title: lesson.title,
      sort_order: lesson.sort_order,
      section_id: lesson.section_id,
      status: lesson.status,
      completed: completedLessons.has(lesson.id),
      locked: false,
    })
  }

  for (const quiz of quizzesRes.data || []) {
    if (!isAdminUser && quiz.status !== 'published') continue
    items.push({
      id: quiz.id,
      type: 'quiz',
      title: quiz.title,
      sort_order: quiz.sort_order,
      section_id: quiz.section_id,
      status: quiz.status,
      completed: passedQuizzes.has(quiz.id),
      locked: false,
    })
  }

  for (const assignment of assignmentsRes.data || []) {
    if (!isAdminUser && assignment.status !== 'published') continue
    items.push({
      id: assignment.id,
      type: 'assignment',
      title: assignment.title,
      sort_order: assignment.sort_order,
      section_id: assignment.section_id,
      status: assignment.status,
      completed: approvedAssignments.has(assignment.id),
      locked: false,
    })
  }

  for (const sim of casesRes.data || []) {
    if (!isAdminUser && sim.status !== 'published') continue
    items.push({
      id: sim.id,
      type: 'case',
      title: sim.title,
      sort_order: sim.sort_order,
      section_id: sim.section_id,
      status: sim.status,
      completed: completedCases.has(sim.id),
      locked: false,
    })
  }

  // Sort by section order then sort_order
  const sectionOrder = new Map(sectionIds.map((id, i) => [id, i]))
  items.sort((a, b) => {
    const sectionDiff = (sectionOrder.get(a.section_id) || 0) - (sectionOrder.get(b.section_id) || 0)
    if (sectionDiff !== 0) return sectionDiff
    return a.sort_order - b.sort_order
  })

  // Apply sequential locking
  if (course?.is_sequential) {
    for (let i = 1; i < items.length; i++) {
      if (!items[i - 1].completed) {
        items[i].locked = true
      }
    }
  }

  return NextResponse.json({ items, isSequential: course?.is_sequential || false })
}
