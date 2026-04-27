import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody } from '@/components/ui/card'
import { Badge, statusBadgeVariant } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function AdminCoursesPage() {
  await requireAdmin()
  const supabase = await createClient()

  const { data: courses } = await supabase
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">講座管理</h1>
        <Link href="/admin/courses/new">
          <Button>新規作成</Button>
        </Link>
      </div>

      {!courses || courses.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-gray-500 text-center py-8">講座がまだありません。</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {courses.map((course) => (
            <Card key={course.id}>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{course.title}</h3>
                    {course.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                        {course.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={statusBadgeVariant(course.status)}>
                        {course.status}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {new Date(course.created_at).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                  </div>
                  <Link href={`/admin/courses/${course.id}/edit`}>
                    <Button variant="secondary" size="sm">
                      編集
                    </Button>
                  </Link>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
