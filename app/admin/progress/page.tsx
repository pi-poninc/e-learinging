import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table } from '@/components/ui/table'

export default async function AdminProgressPage() {
  await requireAdmin()
  const supabase = await createClient()

  // Get all enrollments with user, course, and progress
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select(`
      id,
      status,
      user:profiles (id, name),
      course:courses (id, title)
    `)
    .eq('status', 'active')
    .order('enrolled_at', { ascending: false })

  const progressData = await Promise.all(
    (enrollments || []).map(async (enrollment) => {
      const user = enrollment.user as unknown as { id: string; name: string | null }
      const course = enrollment.course as unknown as { id: string; title: string }

      if (!user || !course) return null

      // Get section IDs for this course
      const { data: sectionRows } = await supabase
        .from('sections')
        .select('id')
        .eq('course_id', course.id)

      const sectionIds = (sectionRows || []).map((s) => s.id)
      if (sectionIds.length === 0) {
        return {
          enrollmentId: enrollment.id,
          userName: user.name || user.id,
          courseTitle: course.title,
          completedLessons: 0,
          totalLessons: 0,
          percent: 0,
        }
      }

      // Get published lesson IDs
      const { data: lessonRows } = await supabase
        .from('lessons')
        .select('id')
        .in('section_id', sectionIds)
        .eq('status', 'published')

      const lessonIds = (lessonRows || []).map((l) => l.id)
      const total = lessonIds.length

      if (total === 0) {
        return {
          enrollmentId: enrollment.id,
          userName: user.name || user.id,
          courseTitle: course.title,
          completedLessons: 0,
          totalLessons: 0,
          percent: 0,
        }
      }

      // Completed lessons for this user
      const { count: completedLessons } = await supabase
        .from('lesson_progress')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('completed', true)
        .in('lesson_id', lessonIds)

      const completed = completedLessons || 0
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0

      return {
        enrollmentId: enrollment.id,
        userName: user.name || user.id,
        courseTitle: course.title,
        completedLessons: completed,
        totalLessons: total,
        percent,
      }
    })
  )

  const rows = progressData.filter(Boolean)

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">進捗確認</h1>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">受講者別進捗</h2>
        </CardHeader>
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <p className="px-6 py-8 text-gray-500 text-center">データがありません。</p>
          ) : (
            <Table headers={['受講者', '講座', '進捗', '完了率']}>
              {rows.map((row) => (
                <tr key={row!.enrollmentId}>
                  <td className="px-6 py-4 text-sm text-gray-900">{row!.userName}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{row!.courseTitle}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {row!.completedLessons}/{row!.totalLessons} レッスン
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${row!.percent}%` }}
                        />
                      </div>
                      <Badge variant={row!.percent === 100 ? 'success' : 'info'}>
                        {row!.percent}%
                      </Badge>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </CardBody>
      </Card>
    </AdminLayout>
  )
}
