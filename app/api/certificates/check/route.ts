import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId } = await request.json()
  if (!courseId) return NextResponse.json({ error: 'Missing courseId' }, { status: 400 })

  // Check if certificate already exists
  const { data: existing } = await supabase
    .from('certificates')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ completed: true, certificateId: existing.id, alreadyIssued: true })
  }

  // Get all sections
  const { data: sections } = await supabase
    .from('sections')
    .select('id')
    .eq('course_id', courseId)

  const sectionIds = (sections || []).map((s) => s.id)
  if (sectionIds.length === 0) {
    return NextResponse.json({ completed: false })
  }

  // Get all published lessons, quizzes, assignments, case simulations
  const [lessonsRes, quizzesRes, assignmentsRes, casesRes] = await Promise.all([
    supabase.from('lessons').select('id').in('section_id', sectionIds).eq('status', 'published'),
    supabase.from('quizzes').select('id').in('section_id', sectionIds).eq('status', 'published'),
    supabase.from('assignments').select('id').in('section_id', sectionIds).eq('status', 'published'),
    supabase.from('case_simulations').select('id').in('section_id', sectionIds).eq('status', 'published'),
  ])

  const lessonIds = (lessonsRes.data || []).map((l) => l.id)
  const quizIds = (quizzesRes.data || []).map((q) => q.id)
  const assignmentIds = (assignmentsRes.data || []).map((a) => a.id)
  const caseIds = (casesRes.data || []).map((c) => c.id)

  // Guard: a course with zero published content should not auto-issue a certificate
  if (lessonIds.length + quizIds.length + assignmentIds.length + caseIds.length === 0) {
    return NextResponse.json({ completed: false, reason: 'no_content' })
  }

  // Check all lessons completed
  if (lessonIds.length > 0) {
    const { count } = await supabase
      .from('lesson_progress')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('completed', true)
      .in('lesson_id', lessonIds)

    if ((count || 0) < lessonIds.length) {
      return NextResponse.json({ completed: false, reason: 'lessons_incomplete' })
    }
  }

  // Check all quizzes passed
  if (quizIds.length > 0) {
    for (const quizId of quizIds) {
      const { data: passed } = await supabase
        .from('quiz_attempts')
        .select('id')
        .eq('user_id', user.id)
        .eq('quiz_id', quizId)
        .eq('passed', true)
        .limit(1)
        .maybeSingle()

      if (!passed) {
        return NextResponse.json({ completed: false, reason: 'quizzes_incomplete' })
      }
    }
  }

  // Check all assignments approved
  if (assignmentIds.length > 0) {
    for (const assignmentId of assignmentIds) {
      const { data: approved } = await supabase
        .from('assignment_submissions')
        .select('id')
        .eq('user_id', user.id)
        .eq('assignment_id', assignmentId)
        .eq('status', 'approved')
        .limit(1)
        .maybeSingle()

      if (!approved) {
        return NextResponse.json({ completed: false, reason: 'assignments_incomplete' })
      }
    }
  }

  // Check all case simulations completed
  if (caseIds.length > 0) {
    const { count } = await supabase
      .from('case_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('completed', true)
      .in('case_simulation_id', caseIds)

    if ((count || 0) < caseIds.length) {
      return NextResponse.json({ completed: false, reason: 'cases_incomplete' })
    }
  }

  // All complete — generate certificate
  const { data: cert, error } = await supabase
    .from('certificates')
    .insert({
      user_id: user.id,
      course_id: courseId,
      certificate_number: 'TEMP', // trigger will set real number
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ completed: true, certificateId: cert.id, alreadyIssued: false })
}
