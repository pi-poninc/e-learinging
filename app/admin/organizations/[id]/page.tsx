import { requireStaff } from '@/lib/auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { orgAdminEnabled } from '@/lib/flags'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ActionButton } from '@/components/review/action-button'
import { OrgContractToggles } from '@/components/review/org-forms'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface Props { params: Promise<{ id: string }> }

export default async function AdminOrgDetailPage({ params }: Props) {
  if (!orgAdminEnabled()) notFound()
  const { id } = await params
  await requireStaff()
  const supabase = await createClient()

  const { data: org } = await supabase.from('organizations').select('id, name, show_submission_content, show_coach_logs').eq('id', id).maybeSingle()
  if (!org) notFound()

  const { data: members } = await supabase.from('organization_members').select('user_id, role, member:profiles(name)').eq('organization_id', id)
  const memberIds = new Set((members || []).map((m) => m.user_id))

  // 追加候補（受講者ロールの全ユーザー・サービスロールで取得）
  const svc = await createServiceClient()
  const { data: students } = await svc.from('profiles').select('id, name').eq('role', 'student').limit(200)
  const candidates = (students || []).filter((s: { id: string }) => !memberIds.has(s.id))

  return (
    <AdminLayout>
      <div className="mb-4"><Link href="/admin/organizations" className="text-sm text-blue-600 hover:text-blue-700">&larr; 企業一覧</Link></div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">{org.name}</h1>

      <Card className="mb-6"><CardHeader><h2 className="text-lg font-semibold">契約設定（プライバシー）</h2></CardHeader>
        <CardBody><OrgContractToggles organizationId={id} submissionContent={org.show_submission_content} coachLogs={org.show_coach_logs} /></CardBody>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">メンバー（{(members || []).length}）</h2></CardHeader>
          <CardBody>
            <div className="space-y-2">
              {(members || []).map((m) => {
                const u = m.member as unknown as { name: string | null } | null
                return (
                  <div key={m.user_id} className="flex items-center justify-between text-sm">
                    <span>{u?.name || '受講者'} {m.role === 'org_admin' && <Badge variant="info">企業管理者</Badge>}</span>
                    <ActionButton endpoint="/api/admin/organizations" body={{ action: 'remove_member', organizationId: id, userId: m.user_id }} label="外す" variant="ghost" />
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
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {candidates.map((c: { id: string; name: string | null }) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span>{c.name || '受講者'}</span>
                  <div className="flex gap-2">
                    <ActionButton endpoint="/api/admin/organizations" body={{ action: 'add_member', organizationId: id, userId: c.id, role: 'learner' }} label="追加" />
                    <ActionButton endpoint="/api/admin/organizations" body={{ action: 'add_member', organizationId: id, userId: c.id, role: 'org_admin' }} label="管理者" variant="secondary" />
                  </div>
                </div>
              ))}
              {candidates.length === 0 && <p className="text-sm text-gray-400">追加できる受講者がいません。</p>}
            </div>
          </CardBody>
        </Card>
      </div>
    </AdminLayout>
  )
}
