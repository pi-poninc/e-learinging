import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/permissions'
import { StudentLayout } from '@/components/layouts/student-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Lesson, CaseSimulation } from '@/lib/db'

interface Props {
  params: Promise<{ courseId: string }>
}

export default async function CourseDetailPage({ params }: Props) {
  const { courseId } = await params
  const profile = await requireAuth()
  const supabase = await createClient()
  const admin = isAdmin(profile.role)

  // Get course
  const { data: course } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single()

  if (!course) notFound()

  // Check enrollment (students only)
  if (!admin) {
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', profile.id)
      .eq('course_id', courseId)
      .eq('status', 'active')
      .single()

    if (!enrollment) redirect('/dashboard')
  }

  // Get sections with lessons
  const { data: sections } = await supabase
    .from('sections')
    .select('*')
    .eq('course_id', courseId)
    .order('sort_order')

  const sectionsWithLessons: { id: string; title: string; sort_order: number; lessons: Lesson[]; cases: CaseSimulation[] }[] = await Promise.all(
    (sections || []).map(async (section) => {
      const query = supabase
        .from('lessons')
        .select('*')
        .eq('section_id', section.id)
        .order('sort_order')

      const casesQuery = supabase
        .from('case_simulations')
        .select('*')
        .eq('section_id', section.id)
        .order('sort_order')

      if (!admin) {
        query.eq('status', 'published')
        casesQuery.eq('status', 'published')
      }

      const [{ data: lessons }, { data: cases }] = await Promise.all([query, casesQuery])
      return {
        id: section.id as string,
        title: section.title as string,
        sort_order: section.sort_order as number,
        lessons: (lessons || []) as Lesson[],
        cases: (cases || []) as CaseSimulation[],
      }
    })
  )

  // Get user progress for all lessons
  const allLessonIds = sectionsWithLessons.flatMap((s) => s.lessons.map((l) => l.id))
  const { data: progressData } = allLessonIds.length > 0
    ? await supabase
        .from('lesson_progress')
        .select('*')
        .eq('user_id', profile.id)
        .in('lesson_id', allLessonIds)
    : { data: [] }

  const progressMap = new Map(
    (progressData || []).map((p) => [p.lesson_id, p])
  )

  const totalLessons = allLessonIds.length
  const completedLessons = (progressData || []).filter((p) => p.completed).length
  const overallProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

  const sectionCount = sectionsWithLessons.length

  return (
    <StudentLayout isAdmin={admin}>
      <div className="mb-4">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:text-blue-700">
          &larr; マイコースに戻る
        </Link>
      </div>

      {/* ヒーロー */}
      <div className="mb-8 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-6 sm:p-8 shadow-sm">
        <h1 className="text-2xl sm:text-3xl font-bold mb-3 text-balance">{course.title}</h1>
        {course.description && (
          <p className="text-blue-50/90 text-sm sm:text-base whitespace-pre-line leading-relaxed max-w-3xl">
            {course.description}
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">{overallProgress}%</span>
            <span className="text-sm text-blue-100">
              {completedLessons}/{totalLessons} レッスン完了
            </span>
          </div>
          {sectionCount > 1 && (
            <span className="text-sm text-blue-100">全{sectionCount}編・{totalLessons}本</span>
          )}
        </div>
        <div className="w-full bg-white/25 rounded-full h-2.5 mt-3 max-w-xl">
          <div
            className="bg-white h-2.5 rounded-full transition-all"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      <div className="space-y-6">
        {sectionsWithLessons.map((section, sIdx) => {
          const secTotal = section.lessons.length
          const secDone = section.lessons.filter((l) => progressMap.get(l.id)?.completed).length
          const secPct = secTotal > 0 ? Math.round((secDone / secTotal) * 100) : 0
          return (
          <Card key={section.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-50 text-blue-600 text-sm font-bold flex items-center justify-center">
                    {sIdx + 1}
                  </span>
                  <h2 className="text-lg font-semibold text-gray-900 truncate">{section.title}</h2>
                </div>
                {secTotal > 0 && (
                  <Badge variant={secPct === 100 ? 'success' : 'info'}>
                    {secDone}/{secTotal}
                  </Badge>
                )}
              </div>
              {secTotal > 0 && (
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3">
                  <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${secPct}%` }} />
                </div>
              )}
            </CardHeader>
            <CardBody className="p-0">
              {section.lessons.length === 0 && section.cases.length === 0 ? (
                <p className="px-6 py-4 text-gray-500 text-sm">コンテンツはまだありません。</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {section.lessons.map((lesson, index) => {
                    const progress = progressMap.get(lesson.id)
                    const isCompleted = progress?.completed
                    const progressPercent = progress
                      ? Math.round((progress.progress_rate as number) * 100)
                      : 0

                    return (
                      <li key={lesson.id}>
                        <Link
                          href={`/lessons/${lesson.id}`}
                          className="flex items-center px-6 py-4 hover:bg-gray-50 transition-colors"
                        >
                          <span className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600 mr-4">
                            {isCompleted ? (
                              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            ) : (
                              index + 1
                            )}
                          </span>
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-900">
                              {lesson.title}
                            </span>
                            {lesson.duration_seconds && (
                              <span className="ml-2 text-xs text-gray-500">
                                {Math.floor(lesson.duration_seconds / 60)}分
                              </span>
                            )}
                          </div>
                          {!isCompleted && progressPercent > 0 && (
                            <span className="text-xs text-gray-500">{progressPercent}%</span>
                          )}
                          {lesson.status === 'draft' && admin && (
                            <Badge variant="warning">下書き</Badge>
                          )}
                        </Link>
                      </li>
                    )
                  })}
                  {section.cases.map((sim) => (
                    <li key={sim.id}>
                      <Link
                        href={`/cases/${sim.id}`}
                        className="flex items-center px-6 py-4 hover:bg-gray-50 transition-colors"
                      >
                        <span className="w-8 h-8 flex items-center justify-center rounded-full bg-teal-50 text-teal-600 mr-4">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                          </svg>
                        </span>
                        <div className="flex-1 flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{sim.title}</span>
                          <Badge variant="success">案件追体験</Badge>
                        </div>
                        {sim.status === 'draft' && admin && (
                          <Badge variant="warning">下書き</Badge>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          )
        })}
      </div>
    </StudentLayout>
  )
}
