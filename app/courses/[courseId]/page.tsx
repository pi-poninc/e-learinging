import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/permissions'
import { StudentLayout } from '@/components/layouts/student-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Lesson } from '@/lib/db'

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

  const sectionsWithLessons: { id: string; title: string; sort_order: number; lessons: Lesson[] }[] = await Promise.all(
    (sections || []).map(async (section) => {
      const query = supabase
        .from('lessons')
        .select('*')
        .eq('section_id', section.id)
        .order('sort_order')

      if (!admin) {
        query.eq('status', 'published')
      }

      const { data: lessons } = await query
      return {
        id: section.id as string,
        title: section.title as string,
        sort_order: section.sort_order as number,
        lessons: (lessons || []) as Lesson[],
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

  return (
    <StudentLayout isAdmin={admin}>
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:text-blue-700">
          &larr; マイコースに戻る
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{course.title}</h1>
        {course.description && (
          <p className="text-gray-600 mb-4">{course.description}</p>
        )}
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {completedLessons}/{totalLessons} レッスン完了
          </span>
          <Badge variant={overallProgress === 100 ? 'success' : 'info'}>
            {overallProgress}%
          </Badge>
        </div>
        <div className="w-full max-w-md bg-gray-200 rounded-full h-2 mt-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      <div className="space-y-6">
        {sectionsWithLessons.map((section) => (
          <Card key={section.id}>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
            </CardHeader>
            <CardBody className="p-0">
              {section.lessons.length === 0 ? (
                <p className="px-6 py-4 text-gray-500 text-sm">レッスンはまだありません。</p>
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
                </ul>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </StudentLayout>
  )
}
