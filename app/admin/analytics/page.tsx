import { requireStaff } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Table } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

interface Row {
  courseId: string
  title: string
  items: number
  enrolled: number
  completed: number
  avgPct: number
}

export default async function AdminAnalyticsPage() {
  await requireStaff()
  const svc = await createServiceClient()

  // 公開講座とセクション
  const { data: courses } = await svc.from('courses').select('id, title').eq('status', 'published').order('created_at')
  const courseIds = (courses || []).map((c) => c.id)
  const titleById = new Map((courses || []).map((c) => [c.id, c.title]))

  const { data: sections } = courseIds.length
    ? await svc.from('sections').select('id, course_id').in('course_id', courseIds)
    : { data: [] }
  const secToCourse = new Map((sections || []).map((s) => [s.id, s.course_id]))
  const secIds = (sections || []).map((s) => s.id)

  // 公開アイテム → 講座ごとの総数 ＋ item→course マップ
  const totalByCourse = new Map<string, number>()
  courseIds.forEach((c) => totalByCourse.set(c, 0))
  const lessonCourse = new Map<string, string>(), quizCourse = new Map<string, string>(),
    caseCourse = new Map<string, string>(), asgCourse = new Map<string, string>()
  if (secIds.length) {
    const [ls, qs, as_, cs] = await Promise.all([
      svc.from('lessons').select('id, section_id').eq('status', 'published').in('section_id', secIds),
      svc.from('quizzes').select('id, section_id').eq('status', 'published').in('section_id', secIds),
      svc.from('assignments').select('id, section_id').eq('status', 'published').in('section_id', secIds),
      svc.from('case_simulations').select('id, section_id').eq('status', 'published').in('section_id', secIds),
    ])
    const reg = (rows: { id: string; section_id: string }[] | null, m: Map<string, string>) => {
      for (const r of rows || []) {
        const cid = secToCourse.get(r.section_id); if (!cid) continue
        m.set(r.id, cid); totalByCourse.set(cid, (totalByCourse.get(cid) || 0) + 1)
      }
    }
    reg(ls.data, lessonCourse); reg(qs.data, quizCourse); reg(as_.data, asgCourse); reg(cs.data, caseCourse)
  }

  // 受講登録（active）→ 講座ごとの受講者
  const { data: enrs } = await svc.from('enrollments').select('user_id, course_id').eq('status', 'active')
  const enrolledByCourse = new Map<string, Set<string>>()
  for (const e of enrs || []) {
    if (!totalByCourse.has(e.course_id)) continue
    if (!enrolledByCourse.has(e.course_id)) enrolledByCourse.set(e.course_id, new Set())
    enrolledByCourse.get(e.course_id)!.add(e.user_id)
  }

  // 完了データ → (user|course) ごとの done 数
  const [lp, qa, ca, su] = await Promise.all([
    svc.from('lesson_progress').select('user_id, lesson_id').eq('completed', true),
    svc.from('quiz_attempts').select('user_id, quiz_id').eq('passed', true),
    svc.from('case_attempts').select('user_id, case_simulation_id').eq('completed', true),
    svc.from('assignment_submissions').select('user_id, assignment_id').eq('status', 'approved'),
  ])
  const done = new Map<string, number>()
  const add = (rows: { user_id: string;[k: string]: string }[] | null, key: string, m: Map<string, string>) => {
    for (const r of rows || []) {
      const cid = m.get(r[key]); if (!cid) continue
      const k = `${r.user_id}|${cid}`; done.set(k, (done.get(k) || 0) + 1)
    }
  }
  add(lp.data, 'lesson_id', lessonCourse); add(qa.data, 'quiz_id', quizCourse)
  add(ca.data, 'case_simulation_id', caseCourse); add(su.data, 'assignment_id', asgCourse)

  // 集計
  const rows: Row[] = (courses || []).map((c) => {
    const total = totalByCourse.get(c.id) || 0
    const users = Array.from(enrolledByCourse.get(c.id) || [])
    let completed = 0, pctSum = 0
    for (const u of users) {
      const d = done.get(`${u}|${c.id}`) || 0
      const pct = total ? Math.min(100, Math.round((d / total) * 100)) : 0
      pctSum += pct
      if (total > 0 && d >= total) completed += 1
    }
    return {
      courseId: c.id, title: titleById.get(c.id) || '(講座)', items: total,
      enrolled: users.length, completed,
      avgPct: users.length ? Math.round(pctSum / users.length) : 0,
    }
  })

  const totalEnroll = rows.reduce((s, r) => s + r.enrolled, 0)
  const totalCompleted = rows.reduce((s, r) => s + r.completed, 0)
  const overallRate = totalEnroll ? Math.round((totalCompleted / totalEnroll) * 100) : 0
  // 完了率が低い（受講者あり）講座＝改善候補
  const lowRate = [...rows]
    .filter((r) => r.enrolled > 0)
    .sort((a, b) => a.completed / a.enrolled - b.completed / b.enrolled)
    .slice(0, 5)
  const sorted = [...rows].sort((a, b) => b.enrolled - a.enrolled)

  const rate = (r: Row) => (r.enrolled ? Math.round((r.completed / r.enrolled) * 100) : 0)

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">効果測定ダッシュボード</h1>

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <Card><CardBody><p className="text-sm text-gray-500">公開講座</p><p className="text-2xl font-bold">{rows.length}</p></CardBody></Card>
        <Card><CardBody><p className="text-sm text-gray-500">のべ受講登録</p><p className="text-2xl font-bold">{totalEnroll}</p></CardBody></Card>
        <Card><CardBody><p className="text-sm text-gray-500">全体修了率</p><p className="text-2xl font-bold">{overallRate}%</p><p className="text-xs text-gray-400">{totalCompleted}/{totalEnroll} 受講が修了</p></CardBody></Card>
      </div>

      <Card className="mb-8">
        <CardHeader><h2 className="text-lg font-semibold">改善候補（受講者がいて修了率が低い講座）</h2></CardHeader>
        <CardBody className="p-0">
          <Table headers={['講座', '受講者', '修了', '修了率']}>
            {lowRate.map((r) => (
              <tr key={r.courseId}>
                <td className="px-6 py-3 text-sm">{r.title}</td>
                <td className="px-6 py-3 text-sm text-right tabular-nums">{r.enrolled}</td>
                <td className="px-6 py-3 text-sm text-right tabular-nums">{r.completed}</td>
                <td className="px-6 py-3 text-sm"><Badge variant={rate(r) >= 70 ? 'success' : rate(r) >= 30 ? 'warning' : 'danger'}>{rate(r)}%</Badge></td>
              </tr>
            ))}
          </Table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">講座別（受講者数順）</h2></CardHeader>
        <CardBody className="p-0">
          <Table headers={['講座', 'アイテム', '受講者', '修了', '修了率', '平均進捗']}>
            {sorted.map((r) => (
              <tr key={r.courseId}>
                <td className="px-6 py-3 text-sm">{r.title}</td>
                <td className="px-6 py-3 text-sm text-right tabular-nums">{r.items}</td>
                <td className="px-6 py-3 text-sm text-right tabular-nums">{r.enrolled}</td>
                <td className="px-6 py-3 text-sm text-right tabular-nums">{r.completed}</td>
                <td className="px-6 py-3 text-sm"><Badge variant={rate(r) >= 70 ? 'success' : rate(r) >= 30 ? 'warning' : 'default'}>{rate(r)}%</Badge></td>
                <td className="px-6 py-3 text-sm text-right tabular-nums">{r.avgPct}%</td>
              </tr>
            ))}
          </Table>
        </CardBody>
      </Card>
    </AdminLayout>
  )
}
