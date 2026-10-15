import { requireStaff } from '@/lib/auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { submissionReviewEnabled } from '@/lib/flags'
import { computeCourseKpi } from '@/lib/review/kpi'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { KpiCourseSelect } from '@/components/review/kpi-course-select'
import { notFound } from 'next/navigation'

interface Props { searchParams: Promise<{ courseId?: string }> }

function Stat({ label, value, suffix }: { label: string; value: string | number | null; suffix?: string }) {
  return (
    <Card><CardBody className="text-center">
      <div className="text-2xl font-bold text-gray-900 tabular-nums">{value == null ? '—' : value}{value != null && suffix}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </CardBody></Card>
  )
}

function Bars({ data }: { data: { label: string; n: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.n))
  return (
    <div className="space-y-1">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2 text-xs">
          <span className="w-12 text-gray-500 shrink-0">{d.label}</span>
          <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${(d.n / max) * 100}%` }} /></div>
          <span className="w-8 text-right tabular-nums text-gray-700">{d.n}</span>
        </div>
      ))}
    </div>
  )
}

export default async function KpiPage({ searchParams }: Props) {
  if (!submissionReviewEnabled()) notFound()
  await requireStaff()
  const { courseId } = await searchParams
  const supabase = await createClient()
  const { data: courses } = await supabase.from('courses').select('id, title').eq('status', 'published').order('created_at', { ascending: false })
  const list = (courses || []) as { id: string; title: string }[]
  const selected = courseId || list[0]?.id

  if (!selected) {
    return <AdminLayout><h1 className="text-2xl font-bold mb-4">KPI</h1><Card><CardBody>コースがありません。</CardBody></Card></AdminLayout>
  }

  const svc = await createServiceClient()
  const k = await computeCourseKpi(svc, selected)

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KPI ダッシュボード</h1>
          <p className="text-sm text-gray-500">提出・添削・習慣化・育成の指標（コース別）</p>
        </div>
        <KpiCourseSelect courses={list} current={selected} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="受講者" value={k.learners} />
        <Stat label="初期7日で5回以上" value={k.early.thresholdRate} suffix="%" />
        <Stat label="直近7日の継続率" value={k.retentionLast7} suffix="%" />
        <Stat label="SLA達成率" value={k.slaRate} suffix="%" />
        <Stat label="平均返却時間" value={k.avgReturnHours} suffix="h" />
        <Stat label="添削1件の平均作業" value={k.avgReviewMinutes} suffix="分" />
        <Stat label="ケース課題 通過率" value={k.caseClearRate} suffix="%" />
        <Stat label="時間内提出率" value={k.timedInTimeRate} suffix="%" />
        <Stat label="ピアレビュー数" value={k.peerReviews} />
        <Stat label="グレード取得者" value={k.gradedUsers} />
        <Stat label="認定取得者" value={k.certifiedUsers} />
        <Stat label="デモデイ発表" value={k.demoEntries} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card><CardHeader><h2 className="text-sm font-semibold text-gray-600">初期7日の提出回数分布</h2></CardHeader><CardBody><Bars data={k.early.dist} /></CardBody></Card>
        <Card><CardHeader><h2 className="text-sm font-semibold text-gray-600">今週の提出日数分布</h2></CardHeader><CardBody><Bars data={k.weekDays} /></CardBody></Card>
      </div>
      <p className="text-xs text-gray-400 mt-4">※ 返却時間・SLAは公開済み添削、作業時間は計測値、学習時間系は提出ベースの近似です。</p>
    </AdminLayout>
  )
}
