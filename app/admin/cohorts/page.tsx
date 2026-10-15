import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cohortEnabled } from '@/lib/flags'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CohortCreateForm } from '@/components/review/cohort-create-form'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function AdminCohortsPage() {
  if (!cohortEnabled()) notFound()
  await requireStaff()
  const supabase = await createClient()

  const { data: cohorts } = await supabase
    .from('cohorts').select('id, name, status, start_date, end_date, course:courses(title)').order('created_at', { ascending: false })
  const { data: courses } = await supabase.from('courses').select('id, title').eq('status', 'published').order('created_at', { ascending: false })

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">コホート（期）</h1>
      <p className="text-sm text-gray-500 mb-6">期ごとに仲間と進めます。個人の順位は表示しません。</p>

      <Card className="mb-6">
        <CardHeader><h2 className="text-lg font-semibold">期を作成</h2></CardHeader>
        <CardBody><CohortCreateForm courses={(courses || []) as { id: string; title: string }[]} /></CardBody>
      </Card>

      <div className="space-y-2">
        {(cohorts || []).map((c) => {
          const course = c.course as unknown as { title: string } | null
          return (
            <Link key={c.id} href={`/admin/cohorts/${c.id}`}>
              <Card className="hover:shadow-md transition-shadow"><CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-900">{c.name}</span>
                    <span className="text-sm text-gray-500 ml-2">{course?.title}</span>
                  </div>
                  <Badge variant={c.status === 'active' ? 'success' : 'default'}>{c.status}</Badge>
                </div>
              </CardBody></Card>
            </Link>
          )
        })}
      </div>
    </AdminLayout>
  )
}
