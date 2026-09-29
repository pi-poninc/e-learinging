import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Table } from '@/components/ui/table'
import { ReportExportButton } from '@/components/admin/report-export'

export const dynamic = 'force-dynamic'

function pct(done: number, total: number) {
  return total > 0 ? Math.round((done / total) * 100) : 0
}

export default async function AdminReportsPage() {
  await requireAdmin()
  const supabase = await createClient()

  const [
    { data: sections },
    { data: lessons },
    { data: enrollments },
    { data: progress },
    { data: groups },
  ] = await Promise.all([
    supabase.from('sections').select('id, course_id'),
    supabase.from('lessons').select('id, section_id').eq('status', 'published'),
    supabase.from('enrollments').select('id, status, enrolled_at, user:profiles(id, name, group_id), course:courses(id, title)'),
    supabase.from('lesson_progress').select('user_id, lesson_id').eq('completed', true),
    supabase.from('groups').select('id, name'),
  ])

  // section_id -> course_id
  const sectionCourse = new Map<string, string>()
  for (const s of sections || []) sectionCourse.set(s.id, s.course_id)
  // course_id -> lessonIds
  const courseLessons = new Map<string, Set<string>>()
  for (const l of lessons || []) {
    const cid = sectionCourse.get(l.section_id)
    if (!cid) continue
    if (!courseLessons.has(cid)) courseLessons.set(cid, new Set())
    courseLessons.get(cid)!.add(l.id)
  }
  // user_id -> completed lessonIds
  const userDone = new Map<string, Set<string>>()
  for (const p of progress || []) {
    if (!userDone.has(p.user_id)) userDone.set(p.user_id, new Set())
    userDone.get(p.user_id)!.add(p.lesson_id)
  }
  const groupName = new Map<string, string>()
  for (const g of groups || []) groupName.set(g.id, g.name)

  // 明細（受講者×講座）
  type Row = {
    userName: string; groupLabel: string; courseTitle: string
    status: string; percent: number; enrolledAt: string
    _groupId: string; _courseId: string; _completed: number
  }
  const rows: Row[] = []
  for (const e of enrollments || []) {
    const user = e.user as unknown as { id: string; name: string | null; group_id: string | null } | null
    const course = e.course as unknown as { id: string; title: string } | null
    if (!user || !course) continue
    const lessonSet = courseLessons.get(course.id) || new Set<string>()
    const doneSet = userDone.get(user.id) || new Set<string>()
    let done = 0
    for (const lid of lessonSet) if (doneSet.has(lid)) done++
    const percent = e.status === 'completed' ? 100 : pct(done, lessonSet.size)
    rows.push({
      userName: user.name || user.id,
      groupLabel: user.group_id ? (groupName.get(user.group_id) || '—') : '未所属',
      courseTitle: course.title,
      status: e.status === 'completed' ? '修了' : e.status === 'active' ? '受講中' : '停止',
      percent,
      enrolledAt: (e.enrolled_at || '').slice(0, 10),
      _groupId: user.group_id || 'none',
      _courseId: course.id,
      _completed: e.status === 'completed' ? 1 : 0,
    })
  }

  // 講座別サマリー
  const byCourse = new Map<string, { title: string; enrolled: number; completed: number; sumPct: number }>()
  for (const r of rows) {
    const k = r._courseId
    if (!byCourse.has(k)) byCourse.set(k, { title: r.courseTitle, enrolled: 0, completed: 0, sumPct: 0 })
    const c = byCourse.get(k)!
    c.enrolled++; c.completed += r._completed; c.sumPct += r.percent
  }
  // 部署別サマリー
  const byGroup = new Map<string, { name: string; enrolled: number; completed: number }>()
  for (const r of rows) {
    const k = r._groupId
    if (!byGroup.has(k)) byGroup.set(k, { name: r.groupLabel, enrolled: 0, completed: 0 })
    const g = byGroup.get(k)!
    g.enrolled++; g.completed += r._completed
  }

  // 受講率・未着手（③）
  const startedCount = rows.filter((r) => r.percent > 0).length
  const notStartedRows = rows.filter((r) => r.status === '受講中' && r.percent === 0)
  const startRate = rows.length ? Math.round((startedCount / rows.length) * 100) : 0

  const csvRows = rows.map((r) => ({
    氏名: r.userName, グループ: r.groupLabel, 講座: r.courseTitle,
    ステータス: r.status, 進捗率: `${r.percent}%`, 受講開始日: r.enrolledAt,
  }))
  const csvHeaders = [
    { key: '氏名', label: '氏名' }, { key: 'グループ', label: 'グループ' },
    { key: '講座', label: '講座' }, { key: 'ステータス', label: 'ステータス' },
    { key: '進捗率', label: '進捗率' }, { key: '受講開始日', label: '受講開始日' },
  ]

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">進捗・成績レポート</h1>
        <ReportExportButton rows={csvRows} headers={csvHeaders} filename="受講レポート.csv" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: '受講登録（延べ）', value: `${rows.length} 件` },
          { label: '受講率（着手済）', value: `${startRate}%` },
          { label: '未着手', value: `${notStartedRows.length} 件` },
        ].map((s) => (
          <Card key={s.label}><CardBody>
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
          </CardBody></Card>
        ))}
      </div>

      {notStartedRows.length > 0 && (
        <Card className="mb-6 border-amber-200">
          <CardHeader>未着手アラート（{notStartedRows.length}件）</CardHeader>
          <CardBody>
            <div className="max-h-40 overflow-auto text-sm text-gray-700 space-y-1">
              {notStartedRows.map((r, i) => (
                <div key={i}>
                  <span className="text-amber-700 font-medium">{r.userName}</span>
                  <span className="text-gray-400"> / {r.groupLabel}</span> — {r.courseTitle}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>講座別 修了率</CardHeader>
          <CardBody>
            {byCourse.size === 0 ? <p className="text-sm text-gray-500">データがありません。</p> : (
              <Table headers={['講座', '受講者', '修了', '修了率', '平均進捗']}>
                {[...byCourse.values()].map((c, i) => (
                  <tr key={i}>
                    <td className="px-6 py-3 font-medium text-gray-900">{c.title}</td>
                    <td className="px-6 py-3">{c.enrolled}</td>
                    <td className="px-6 py-3">{c.completed}</td>
                    <td className="px-6 py-3">{pct(c.completed, c.enrolled)}%</td>
                    <td className="px-6 py-3">{c.enrolled ? Math.round(c.sumPct / c.enrolled) : 0}%</td>
                  </tr>
                ))}
              </Table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>部署（グループ）別 修了率</CardHeader>
          <CardBody>
            {byGroup.size === 0 ? <p className="text-sm text-gray-500">データがありません。</p> : (
              <Table headers={['グループ', '受講者', '修了', '修了率']}>
                {[...byGroup.values()].map((g, i) => (
                  <tr key={i}>
                    <td className="px-6 py-3 font-medium text-gray-900">{g.name}</td>
                    <td className="px-6 py-3">{g.enrolled}</td>
                    <td className="px-6 py-3">{g.completed}</td>
                    <td className="px-6 py-3">{pct(g.completed, g.enrolled)}%</td>
                  </tr>
                ))}
              </Table>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>受講者×講座 明細（{rows.length}件）</CardHeader>
        <CardBody>
          {rows.length === 0 ? <p className="text-sm text-gray-500">データがありません。</p> : (
            <div className="max-h-[28rem] overflow-auto">
              <Table headers={['氏名', 'グループ', '講座', 'ステータス', '進捗率', '受講開始日']}>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-6 py-3">{r.userName}</td>
                    <td className="px-6 py-3 text-gray-500">{r.groupLabel}</td>
                    <td className="px-6 py-3">{r.courseTitle}</td>
                    <td className="px-6 py-3">{r.status}</td>
                    <td className="px-6 py-3">{r.percent}%</td>
                    <td className="px-6 py-3 text-gray-500">{r.enrolledAt}</td>
                  </tr>
                ))}
              </Table>
            </div>
          )}
        </CardBody>
      </Card>
    </AdminLayout>
  )
}
