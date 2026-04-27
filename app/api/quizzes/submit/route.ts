import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface AnswerInput {
  questionId: string
  selectedOptionIds?: string[]
  orderingResult?: string[]
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { quizId, answers } = body as { quizId: string; answers: AnswerInput[] }

  if (!quizId || !answers) {
    return NextResponse.json({ error: 'Missing quizId or answers' }, { status: 400 })
  }

  // Get quiz with questions and options (server-side has full access via RLS)
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('id, passing_score, section_id')
    .eq('id', quizId)
    .single()

  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })

  // Verify enrollment
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role === 'student') {
    const { data: section } = await supabase
      .from('sections')
      .select('course_id')
      .eq('id', quiz.section_id)
      .single()

    if (section) {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('user_id', user.id)
        .eq('course_id', section.course_id)
        .eq('status', 'active')
        .single()

      if (!enrollment) {
        return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })
      }
    }
  }

  // Get all questions with options
  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('id, question_type, points, quiz_options:quiz_options(id, is_correct, correct_position)')
    .eq('quiz_id', quizId)
    .order('sort_order')

  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: 'No questions found' }, { status: 400 })
  }

  // Grade each answer
  let totalPoints = 0
  let earnedPoints = 0
  const gradedAnswers: {
    question_id: string
    selected_option_ids: string[]
    ordering_result: string[]
    is_correct: boolean
    points_earned: number
  }[] = []

  for (const question of questions) {
    totalPoints += question.points
    const answer = answers.find((a) => a.questionId === question.id)
    const options = (question.quiz_options || []) as { id: string; is_correct: boolean; correct_position: number | null }[]

    let isCorrect = false
    let pointsEarned = 0

    if (answer) {
      if (question.question_type === 'ordering') {
        // Check if ordering matches correct positions
        const correctOrder = [...options]
          .filter((o) => o.correct_position !== null)
          .sort((a, b) => (a.correct_position || 0) - (b.correct_position || 0))
          .map((o) => o.id)

        isCorrect = JSON.stringify(answer.orderingResult || []) === JSON.stringify(correctOrder)
      } else {
        // single_choice, multiple_choice, true_false
        const correctOptionIds = options.filter((o) => o.is_correct).map((o) => o.id).sort()
        const selectedIds = (answer.selectedOptionIds || []).sort()

        isCorrect = JSON.stringify(selectedIds) === JSON.stringify(correctOptionIds)
      }

      if (isCorrect) {
        pointsEarned = question.points
        earnedPoints += pointsEarned
      }
    }

    gradedAnswers.push({
      question_id: question.id,
      selected_option_ids: answer?.selectedOptionIds || [],
      ordering_result: answer?.orderingResult || [],
      is_correct: isCorrect,
      points_earned: pointsEarned,
    })
  }

  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0
  const passed = score >= quiz.passing_score

  // Create attempt
  const { data: attempt, error: attemptError } = await supabase
    .from('quiz_attempts')
    .insert({
      user_id: user.id,
      quiz_id: quizId,
      score,
      total_points: totalPoints,
      earned_points: earnedPoints,
      passed,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (attemptError || !attempt) {
    return NextResponse.json({ error: attemptError?.message || 'Failed to create attempt' }, { status: 500 })
  }

  // Create answers
  const answerRecords = gradedAnswers.map((a) => ({
    attempt_id: attempt.id,
    ...a,
  }))

  await supabase.from('quiz_answers').insert(answerRecords)

  return NextResponse.json({
    attemptId: attempt.id,
    score,
    totalPoints,
    earnedPoints,
    passed,
    passingScore: quiz.passing_score,
    answers: gradedAnswers,
  })
}
