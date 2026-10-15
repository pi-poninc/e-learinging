import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cohortEnabled } from '@/lib/flags'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ActionButton } from '@/components/review/action-button'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface Props { params: Promise<{ id: string }> }

export default async function AdminCohortDetailPage({ params }: Props) {
  if (!cohortEnabled()) notFound()
  const { id } = await params
  await requireStaff()
  const supabase = await createClient()

  const { data: cohort } = await supabase.from('cohorts').select('id, name, course_id, status, course:courses(title)').eq('id', id).maybeSingle()
  if (!cohort) notFound()
  const course = cohort.course as unknown as { title: string } | null

  const { data: members } = await supabase
    .from('cohort_members').select('user_id, role, member:profiles(name)').eq('cohort_id', id)
  const memberIds = new Set((members || []).map((m) => m.user_id))

  // コースの受講者で、まだメンバーでない人
  const { data: enr } = await supabase
    .from('enrollments').select('user_id, user:profiles(name)').eq('course_id', cohort.course_id).eq('status', 'active')
  const candidates = (enr || []).filter((e) => !memberIds.has(e.user_id))

  return (
    <AdminLayout>
      <div className="mb-4"><Link href="/admin/cohorts" className="text-sm text-blue-600 hover:text-blue-700">&larr; 期の一覧</Link></div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">{cohort.name}</h1>
      <p className="text-sm text-gray-500 mb-6">{course?.title}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">メンバー（{(members || []).length}）</h2></CardHeader>
          <CardBody>
            <div className="space-y-2">
              {(members || []).map((m) => {
                const u = m.member as unknown as { name: string | null } | null
                return (
                  <div key={m.user_id} className="flex items-center justify-between text-sm">
                    <span>{u?.name || '受講者'} {m.role === 'mentor' && <Badge variant="info">メンター</Badge>}</span>
                    <ActionButton endpoint="/api/admin/cohorts" body={{ action: 'remove_member', cohortId: id, userId: m.user_id }} label="外す" variant="ghost" />
                  </div>
                )
              })}
              {(members || []).length === 0 && <p className="text-sm text-gray-400">まだメンバーがいません。</p>}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h2 className="text-lg font-semibold">受講者を追加</h2></CardHeader>
          <CardBody>
            <div className="space-y-2">
              {candidates.map((c) => {
                const u = c.user as unknown as { name: string | null } | null
                return (
                  <div key={c.user_id} className="flex items-center justify-between text-sm">
                    <span>{u?.name || '受講者'}</span>
                    <div className="flex gap-2">
                      <ActionButton endpoint="/api/admin/cohorts" body={{ action: 'add_member', cohortId: id, userId: c.user_id, role: 'learner' }} label="追加" />
                      <ActionButton endpoint="/api/admin/cohorts" body={{ action: 'add_member', cohortId: id, userId: c.user_id, role: 'mentor' }} label="メンター" variant="secondary" />
                    </div>
                  </div>
                )
              })}
              {candidates.length === 0 && <p className="text-sm text-gray-400">追加できる受講者がいません。</p>}
            </div>
          </CardBody>
        </Card>
      </div>
    </AdminLayout>
  )
}
