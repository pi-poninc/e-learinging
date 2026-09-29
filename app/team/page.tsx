import Link from 'next/link'
import { requireStaff } from '@/lib/auth'
import { isAdmin, isManager } from '@/lib/permissions'
import { createServiceClient } from '@/lib/supabase/server'
import { getTeamMembers } from '@/lib/team-data'
import { StudentLayout } from '@/components/layouts/student-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Table } from '@/components/ui/table'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const profile = await requireStaff()
  const manager = isManager(profile.role)
  const admin = isAdmin(profile.role)

  // マネージャーは自部署のみ / 管理者は全員
  const scopeGroupId = manager ? profile.group_id : null

  if (manager && !profile.group_id) {
    return (
      <StudentLayout isAdmin={admin} showTeam>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">チームの進捗</h1>
        <Card><CardBody>
          <p className="text-gray-600">担当部署（グループ）が設定されていません。管理者にグループの割り当てを依頼してください。</p>
        </CardBody></Card>
      </StudentLayout>
    )
  }

  const svc = await createServiceClient()
  const members = await getTeamMembers(svc, scopeGroupId)

  const total = members.length
  const started = members.filter((m) => !m.notStarted && m.assigned > 0).length
  const withAssign = members.filter((m) => m.assigned > 0).length
  const notStarted = members.filter((m) => m.notStarted)
  const startRate = withAssign ? Math.round((started / withAssign) * 100) : 0

  const stats = [
    { label: '対象人数', value: `${total} 人` },
    { label: '受講率（着手/割当済）', value: `${startRate}%` },
    { label: '未着手', value: `${notStarted.length} 人` },
  ]

  return (
    <StudentLayout isAdmin={admin} showTeam>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        チームの進捗{manager ? '' : '（全体）'}
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {stats.map((s) => (
          <Card key={s.label}><CardBody>
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
          </CardBody></Card>
        ))}
      </div>

      {notStarted.length > 0 && (
        <Card className="mb-6 border-amber-200">
          <CardHeader>未着手アラート（{notStarted.length}人）</CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600">
              割り当て済みだが1つも着手していない人：
              <span className="text-amber-700 font-medium"> {notStarted.map((m) => m.name).join('、')}</span>
            </p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>メンバー一覧（{total}人）</CardHeader>
        <CardBody>
          {total === 0 ? (
            <p className="text-sm text-gray-500">対象の受講者がいません。</p>
          ) : (
            <Table headers={['氏名', '所属', '割当講座', '修了', '平均進捗', '']}>
              {members.map((m) => (
                <tr key={m.id} className={m.notStarted ? 'bg-amber-50' : ''}>
                  <td className="px-6 py-3 font-medium text-gray-900">{m.name}</td>
                  <td className="px-6 py-3 text-gray-500">{m.groupLabel}</td>
                  <td className="px-6 py-3">{m.assigned}</td>
                  <td className="px-6 py-3">{m.completed}</td>
                  <td className="px-6 py-3">{m.avgProgress}%{m.notStarted && <span className="ml-2 text-xs text-amber-600">未着手</span>}</td>
                  <td className="px-6 py-3 text-right">
                    <Link href={`/team/${m.id}`} className="text-sm text-blue-600 hover:underline">カルテ →</Link>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </CardBody>
      </Card>
    </StudentLayout>
  )
}
