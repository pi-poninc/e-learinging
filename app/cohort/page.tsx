import { requireAuth } from '@/lib/auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/permissions'
import { cohortEnabled } from '@/lib/flags'
import { getReviewSettings } from '@/lib/review/service'
import { computeCohortOverview } from '@/lib/review/cohort'
import { StudentLayout } from '@/components/layouts/student-layout'
import { Card, CardBody } from '@/components/ui/card'
import { CohortShareToggle } from '@/components/review/cohort-share-toggle'
import { ActionButton } from '@/components/review/action-button'
import { notFound } from 'next/navigation'

export default async function CohortPage() {
  if (!cohortEnabled()) notFound()
  const profile = await requireAuth()
  const supabase = await createClient()

  const { data: memberships } = await supabase
    .from('cohort_members').select('cohort_id, share_activity, cohort:cohorts(id, name, course_id, status)').eq('user_id', profile.id)
  const active = (memberships || []).find((m) => (m.cohort as unknown as { status: string } | null)?.status === 'active') || (memberships || [])[0]

  if (!active) {
    return (
      <StudentLayout isAdmin={isAdmin(profile.role)}>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">仲間（コホート）</h1>
          <Card><CardBody><p className="text-sm text-gray-500">まだ期（コホート）に参加していません。</p></CardBody></Card>
        </div>
      </StudentLayout>
    )
  }

  const cohort = active.cohort as unknown as { id: string; name: string; course_id: string; status: string }
  const settings = await getReviewSettings(supabase, cohort.course_id)
  const svc = await createServiceClient()
  const ov = await computeCohortOverview(svc, cohort.id, profile.id, settings.weeklyGoalDays, settings.weekStart)

  return (
    <StudentLayout isAdmin={isAdmin(profile.role)}>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{cohort.name}</h1>
        <p className="text-sm text-gray-500 mb-4">仲間と一緒に続けましょう。順位はつけません。お互いを応援する場です。</p>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card><CardBody className="text-center"><div className="text-2xl font-bold text-gray-900">{ov.memberCount}</div><div className="text-xs text-gray-500">メンバー</div></CardBody></Card>
          <Card><CardBody className="text-center"><div className="text-2xl font-bold text-blue-600">{ov.weekGoalRate}%</div><div className="text-xs text-gray-500">今週の目標達成率</div></CardBody></Card>
          <Card><CardBody className="text-center"><div className="text-2xl font-bold text-emerald-600">{ov.weekSubmissionTotal}</div><div className="text-xs text-gray-500">今週の提出合計</div></CardBody></Card>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <CohortShareToggle cohortId={cohort.id} initial={active.share_activity} />
          <a href="/cohort/demo" className="text-sm text-indigo-600 hover:text-indigo-700">🎤 デモデイへ →</a>
        </div>

        <h2 className="text-lg font-semibold text-gray-800 mb-2">仲間のうごき</h2>
        {ov.timeline.length === 0 && (
          <Card><CardBody><p className="text-sm text-gray-500">まだ共有された提出はありません。</p></CardBody></Card>
        )}
        <div className="space-y-2">
          {ov.timeline.map((t) => (
            <Card key={t.submissionId}><CardBody>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-sm text-gray-700">
                  <span className="font-medium">{t.name}</span> さんが「{t.taskTitle}」を提出
                  <span className="text-xs text-gray-400 ml-2">{new Date(t.submittedAt).toLocaleString('ja-JP')}</span>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-xs text-gray-500">🎉 {t.cheers}</span>
                  {!t.cheeredByMe && <ActionButton endpoint="/api/cohort" body={{ action: 'cheer', submissionId: t.submissionId }} label="応援する" variant="ghost" />}
                </div>
              </div>
            </CardBody></Card>
          ))}
        </div>
      </div>
    </StudentLayout>
  )
}
