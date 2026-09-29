import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { requireStaff } from '@/lib/auth'
import { isAdmin, isManager } from '@/lib/permissions'
import { createServiceClient } from '@/lib/supabase/server'
import { getUserRecord } from '@/lib/team-data'
import { StudentLayout } from '@/components/layouts/student-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Table } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ userId: string }> }

export default async function UserRecordPage({ params }: Props) {
  const { userId } = await params
  const staff = await requireStaff()
  const svc = await createServiceClient()

  // マネージャーは自部署のメンバーのみ閲覧可
  if (isManager(staff.role)) {
    const { data: target } = await svc.from('profiles').select('group_id').eq('id', userId).maybeSingle()
    if (!target || !staff.group_id || target.group_id !== staff.group_id) {
      redirect('/team')
    }
  }

  const record = await getUserRecord(svc, userId)
  if (!record) notFound()

  return (
    <StudentLayout isAdmin={isAdmin(staff.role)} showTeam>
      <div className="mb-6">
        <Link href="/team" className="text-sm text-blue-600 hover:underline">← チーム一覧へ</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">{record.profile.name} さんの学習カルテ</h1>
        <p className="text-sm text-gray-500 mt-1">
          所属: {record.profile.groupLabel}・総学習時間: {record.totalMinutes} 分
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>受講状況</CardHeader>
        <CardBody>
          {record.courses.length === 0 ? (
            <p className="text-sm text-gray-500">受講中の講座がありません。</p>
          ) : (
            <Table headers={['講座', 'ステータス', '進捗率', '学習時間', 'テスト最高点', '受講期限']}>
              {record.courses.map((c, i) => {
                const overdue = c.dueDate && c.status !== '修了' && new Date(c.dueDate) < new Date(new Date().toDateString())
                return (
                  <tr key={i}>
                    <td className="px-6 py-3 font-medium text-gray-900">{c.courseTitle}</td>
                    <td className="px-6 py-3">
                      <Badge variant={c.status === '修了' ? 'success' : 'info'}>{c.status}</Badge>
                    </td>
                    <td className="px-6 py-3">{c.progress}%</td>
                    <td className="px-6 py-3">{c.watchedMinutes} 分</td>
                    <td className="px-6 py-3">{c.bestScore !== null ? `${c.bestScore} 点` : '—'}</td>
                    <td className={`px-6 py-3 ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                      {c.dueDate ? `${new Date(c.dueDate).toLocaleDateString('ja-JP')}${overdue ? '（期限切れ）' : ''}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </Table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>取得した修了証（{record.certificates.length}）</CardHeader>
        <CardBody>
          {record.certificates.length === 0 ? (
            <p className="text-sm text-gray-500">まだありません。</p>
          ) : (
            <ul className="text-sm space-y-1">
              {record.certificates.map((c, i) => (
                <li key={i} className="text-gray-700">
                  {c.courseTitle} — {c.number}（{c.issuedAt}）
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </StudentLayout>
  )
}
