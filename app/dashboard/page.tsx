import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/permissions'
import { StudentLayout } from '@/components/layouts/student-layout'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export default async function DashboardPage() {
  // console.log('[dashboard] start rendering')
  const profile = await requireAuth()
  // console.log('[dashboard] auth done, profile:', profile)
  const supabase = await createClient()

  // Get enrolled courses with progress
  // console.log('[dashboard] querying enrollments...')
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select(`
      id,
      status,
      due_date,
      course:courses (
        id,
        title,
        description,
        thumbnail_url,
        status
      )
    `)
    .eq('user_id', profile.id)
    .eq('status', 'active')

  // console.log('[dashboard] enrollments:', enrollments?.length, 'error:', enrollError?.message)

  // Get lesson progress for each enrolled course
  const coursesWithProgress = await Promise.all(
    (enrollments || []).map(async (enrollment) => {
      const course = enrollment.course as unknown as { id: string; title: string; description: string | null; thumbnail_url: string | null; status: string }
      if (!course) return null

      // Get all sections for this course
      const { data: sectionRows } = await supabase
        .from('sections')
        .select('id')
        .eq('course_id', course.id)

      const sectionIds = (sectionRows || []).map((s) => s.id)
      if (sectionIds.length === 0) {
        return { ...course, totalLessons: 0, completedLessons: 0, progressPercent: 0, dueDate: (enrollment as unknown as { due_date: string | null }).due_date }
      }

      // Get total published lessons count
      const { count: totalLessons } = await supabase
        .from('lessons')
        .select('id', { count: 'exact', head: true })
        .in('section_id', sectionIds)
        .eq('status', 'published')

      // Get all published lesson IDs for this course
      const { data: lessonRows } = await supabase
        .from('lessons')
        .select('id')
        .in('section_id', sectionIds)
        .eq('status', 'published')

      const lessonIds = (lessonRows || []).map((l) => l.id)
      if (lessonIds.length === 0) {
        return { ...course, totalLessons: 0, completedLessons: 0, progressPercent: 0, dueDate: (enrollment as unknown as { due_date: string | null }).due_date }
      }

      // Get completed lessons count for this user
      const { count: completedLessons } = await supabase
        .from('lesson_progress')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('completed', true)
        .in('lesson_id', lessonIds)

      const total = totalLessons || 0
      const completed = completedLessons || 0
      const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0

      return {
        ...course,
        totalLessons: total,
        completedLessons: completed,
        progressPercent,
        dueDate: (enrollment as unknown as { due_date: string | null }).due_date,
      }
    })
  )

  const courses = coursesWithProgress.filter(Boolean)

  // お知らせ（RLSで「全員向け」＋「自分のグループ向け」だけが返る）
  const { data: announcements } = await supabase
    .from('announcements')
    .select('id, title, body, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <StudentLayout isAdmin={isAdmin(profile.role)}>
      {announcements && announcements.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">お知らせ</h2>
          <div className="space-y-3">
            {announcements.map((a) => (
              <Card key={a.id}>
                <CardBody>
                  <p className="font-semibold text-gray-900">{a.title}</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap mt-1">{a.body}</p>
                  <p className="text-xs text-gray-400 mt-2">{(a.created_at || '').slice(0, 10)}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-900 mb-6">マイコース</h1>

      {courses.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-gray-500 text-center py-8">
              受講中のコースはまだありません。
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Link key={course!.id} href={`/courses/${course!.id}`}>
              <Card className="hover:shadow-md transition-shadow h-full">
                {course!.thumbnail_url && (
                  <div className="h-40 bg-gray-200 rounded-t-lg overflow-hidden">
                    <img
                      src={course!.thumbnail_url}
                      alt={course!.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardBody>
                  <h3 className="font-semibold text-gray-900 mb-2">{course!.title}</h3>
                  {course!.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {course!.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">
                      {course!.completedLessons}/{course!.totalLessons} レッスン完了
                    </span>
                    <Badge variant={course!.progressPercent === 100 ? 'success' : 'info'}>
                      {course!.progressPercent}%
                    </Badge>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${course!.progressPercent}%` }}
                    />
                  </div>
                  {course!.dueDate && course!.progressPercent < 100 && (
                    <p
                      className={`text-xs mt-2 ${
                        new Date(course!.dueDate) < new Date(new Date().toDateString())
                          ? 'text-red-600 font-medium'
                          : 'text-gray-500'
                      }`}
                    >
                      受講期限: {new Date(course!.dueDate).toLocaleDateString('ja-JP')}
                      {new Date(course!.dueDate) < new Date(new Date().toDateString()) ? '（期限切れ）' : ''}
                    </p>
                  )}
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </StudentLayout>
  )
}
