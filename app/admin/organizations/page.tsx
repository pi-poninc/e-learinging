import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { orgAdminEnabled } from '@/lib/flags'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { OrgCreateForm } from '@/components/review/org-forms'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function AdminOrganizationsPage() {
  if (!orgAdminEnabled()) notFound()
  await requireStaff()
  const supabase = await createClient()
  const { data: orgs } = await supabase.from('organizations').select('id, name, plan, contract_end').order('created_at', { ascending: false })

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">企業管理</h1>
      <p className="text-sm text-gray-500 mb-6">外部研修として提供する企業と、その受講者を管理します。</p>

      <Card className="mb-6"><CardHeader><h2 className="text-lg font-semibold">企業を作成</h2></CardHeader><CardBody><OrgCreateForm /></CardBody></Card>

      <div className="space-y-2">
        {(orgs || []).map((o) => (
          <Link key={o.id} href={`/admin/organizations/${o.id}`}>
            <Card className="hover:shadow-md transition-shadow"><CardBody>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{o.name}</span>
                <span className="text-xs text-gray-400">{o.plan || ''}{o.contract_end ? `／〜${o.contract_end}` : ''}</span>
              </div>
            </CardBody></Card>
          </Link>
        ))}
        {(orgs || []).length === 0 && <Card><CardBody><p className="text-sm text-gray-500">企業はまだありません。</p></CardBody></Card>}
      </div>
    </AdminLayout>
  )
}
