import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody } from '@/components/ui/card'

export default async function AdminDashboardPage() {
  await requireAdmin()
  const supabase = await createClient()

  const [
    { count: coursesCount },
    { count: usersCount },
    { count: enrollmentsCount },
  ] = await Promise.all([
    supabase.from('courses').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('enrollments').select('id', { count: 'exact', head: true }),
  ])

  const stats = [
    { label: '講座数', value: coursesCount || 0 },
    { label: 'ユーザー数', value: usersCount || 0 },
    { label: '受講登録数', value: enrollmentsCount || 0 },
  ]

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">管理ダッシュボード</h1>

      <div className="grid md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardBody>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </AdminLayout>
  )
}
