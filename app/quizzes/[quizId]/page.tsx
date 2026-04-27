import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/permissions'
import { StudentLayout } from '@/components/layouts/student-layout'
import { QuizPlayer } from '@/components/quiz-player'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

interface Props {
  params: Promise<{ quizId: string }>
}

export default async function QuizPage({ params }: Props) {
  const { quizId } = await params
  const profile = await requireAuth()
  const supabase = await createClient()
  const admin = isAdmin(profile.role)

  // Get quiz with section/course info
  const { data: quiz } = await supabase
    .from('quizzes')
    .select(`
      *,
      section:sections (
        id, title, course_id,
        course:courses (id, title)
      )
    `)
    .eq('id', quizId)
    .single()

  if (!quiz) notFound()

  const section = quiz.section as unknown as {
    id: string; title: string; course_id: string
    course: { id: string; title: string }
  }

  if (!admin && quiz.status !== 'published') notFound()

  // Check enrollment for students
  if (!admin) {
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', profile.id)
      .eq('course_id', section.course_id)
      .eq('status', 'active')
      .single()

    if (!enrollment) redirect('/dashboard')
  }

  // Get questions with options (strip correct answers for client)
  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('id, question_type, question_text, explanation, sort_order, points, quiz_options:quiz_options(id, option_text, sort_order)')
    .eq('quiz_id', quizId)
    .order('sort_order')

  const clientQuestions = (questions || []).map((q) => ({
    id: q.id,
    question_type: q.question_type as 'single_choice' | 'multiple_choice' | 'true_false' | 'ordering',
    question_text: q.question_text,
    explanation: q.explanation,
    sort_order: q.sort_order,
    points: q.points,
    options: ((q.quiz_options || []) as { id: string; option_text: string; sort_order: number }[])
      .sort((a, b) => a.sort_order - b.sort_order),
  }))

  // Check if already passed
  const { data: passedAttempt } = await supabase
    .from('quiz_attempts')
    .select('id')
    .eq('user_id', profile.id)
    .eq('quiz_id', quizId)
    .eq('passed', true)
    .limit(1)
    .maybeSingle()

  return (
    <StudentLayout isAdmin={admin}>
      <div className="mb-4">
        <Link href={`/courses/${section.course_id}`} className="text-sm text-blue-600 hover:text-blue-700">
          &larr; {section.course.title} に戻る
        </Link>
      </div>

      <div className="max-w-3xl mx-auto">
        <QuizPlayer
          quizId={quizId}
          quizTitle={quiz.title}
          passingScore={quiz.passing_score}
          timeLimitMinutes={quiz.time_limit_minutes}
          questions={clientQuestions}
          alreadyPassed={!!passedAttempt}
        />
      </div>
    </StudentLayout>
  )
}
