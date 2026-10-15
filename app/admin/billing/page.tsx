import { requireStaff } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { billingEnabled } from '@/lib/flags'
import { formatPriceJpy } from '@/lib/billing'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Table } from '@/components/ui/table'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AdminBillingPage() {
  await requireStaff()
  if (!billingEnabled()) redirect('/admin')

  const svc = await createServiceClient()
  const { data: purchases } = await svc
    .from('course_purchases')
    .select('id, user_id, course_id, amount_jpy, status, created_at, course:courses(title)')
    .order('created_at', { ascending: false })
    .limit(500)

  const rows = purchases || []
  const paid = rows.filter((r) => r.status === 'paid')
  const total = paid.reduce((sum, r) => sum + (r.amount_jpy || 0), 0)

  // 購入者のメール
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const emailById: Record<string, string> = {}
  for (const u of list?.users || []) emailById[u.id] = u.email || ''

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">売上・購入履歴</h1>

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <Card><CardBody>
          <p className="text-sm text-gray-500">累計売上（有効な購入）</p>
          <p className="text-2xl font-bold text-gray-900">{formatPriceJpy(total)}</p>
        </CardBody></Card>
        <Card><CardBody>
          <p className="text-sm text-gray-500">購入件数</p>
          <p className="text-2xl font-bold text-gray-900">{paid.length} 件</p>
        </CardBody></Card>
        <Card><CardBody>
          <p className="text-sm text-gray-500">返金</p>
          <p className="text-2xl font-bold text-gray-900">{rows.length - paid.length} 件</p>
        </CardBody></Card>
      </div>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">明細（最新500件）</h2></CardHeader>
        <CardBody>
          {rows.length === 0 ? (
            <p className="text-gray-600">まだ購入はありません。</p>
          ) : (
            <Table headers={['日時', '購入者', '講座', '金額', '状態']}>
              {rows.map((r) => {
                const course = r.course as unknown as { title: string } | null
                return (
                  <tr key={r.id}>
                    <td className="px-6 py-3 text-sm">{new Date(r.created_at).toLocaleString('ja-JP')}</td>
                    <td className="px-6 py-3 text-sm">{emailById[r.user_id] || r.user_id.slice(0, 8)}</td>
                    <td className="px-6 py-3 text-sm">{course?.title || '—'}</td>
                    <td className="px-6 py-3 text-sm text-right tabular-nums">{formatPriceJpy(r.amount_jpy)}</td>
                    <td className="px-6 py-3 text-sm">{r.status === 'paid' ? '購入済み' : '返金'}</td>
                  </tr>
                )
              })}
            </Table>
          )}
        </CardBody>
      </Card>
    </AdminLayout>
  )
}
