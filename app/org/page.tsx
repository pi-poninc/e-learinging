import { requireAuth } from '@/lib/auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isAdmin, isStaff } from '@/lib/permissions'
import { orgAdminEnabled } from '@/lib/flags'
import { computeOrgOverview } from '@/lib/review/org'
import { StudentLayout } from '@/components/layouts/student-layout'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { notFound, redirect } from 'next/navigation'

export default async function OrgDashboardPage() {
  if (!orgAdminEnabled()) notFound()
  const profile = await requireAuth()
  const supabase = await createClient()

  // 自分が org_admin の組織（プラットフォームのスタッフは管理画面へ）
  const { data: adminOf } = await supabase.from('organization_members').select('organization_id').eq('user_id', profile.id).eq('role', 'org_admin').limit(1)
  const orgId = adminOf?.[0]?.organization_id
  if (!orgId) {
    if (isStaff(profile.role)) redirect('/admin/organizations')
    redirect('/dashboard')
  }

  const { data: org } = await supabase.from('organizations').select('name').eq('id', orgId).maybeSingle()
  const svc = await createServiceClient()
  const ov = await computeOrgOverview(svc, orgId!)

  return (
    <StudentLayout isAdmin={isAdmin(profile.role)}>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{org?.name || '企業'} ダッシュボード</h1>
        <p className="text-sm text-gray-500 mb-6">自社の受講者の状況です。提出物の中身やAIコーチの会話は、契約設定で許可されない限り表示されません。</p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card><CardBody className="text-center"><div className="text-2xl font-bold text-gray-900">{ov.learnerCount}</div><div className="text-xs text-gray-500">受講者</div></CardBody></Card>
          <Card><CardBody className="text-center"><div className="text-2xl font-bold text-blue-600">{ov.submittedThisWeek}</div><div className="text-xs text-gray-500">今週提出した人数</div></CardBody></Card>
          <Card><CardBody className="text-center"><div className="text-2xl font-bold text-emerald-600">{ov.weekSubmissionTotal}</div><div className="text-xs text-gray-500">今週の提出合計</div></CardBody></Card>
        </div>

        <Card>
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="py-2">受講者</th><th className="py-2">今週の提出日数</th><th className="py-2">直近7日</th><th className="py-2">グレード</th><th className="py-2">認定</th>
                </tr></thead>
                <tbody>
                  {ov.rows.map((r) => (
                    <tr key={r.userId} className="border-b border-gray-50">
                      <td className="py-2">{r.name}</td>
                      <td className="py-2 tabular-nums">{r.weekDays}/7</td>
                      <td className="py-2">{r.activeLast7 ? <Badge variant="success">活動中</Badge> : <Badge variant="default">—</Badge>}</td>
                      <td className="py-2 tabular-nums">{r.gradeLevel || '—'}</td>
                      <td className="py-2 tabular-nums">{r.certs}</td>
                    </tr>
                  ))}
                  {ov.rows.length === 0 && <tr><td colSpan={5} className="py-3 text-gray-400">受講者がいません。</td></tr>}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>
    </StudentLayout>
  )
}
