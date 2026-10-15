import { requireAuth } from '@/lib/auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isAdmin, isStaff } from '@/lib/permissions'
import { cohortEnabled } from '@/lib/flags'
import { StudentLayout } from '@/components/layouts/student-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { DemoEntryForm } from '@/components/review/demo-entry-form'
import { DemoEvalForm } from '@/components/review/demo-eval-form'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function CohortDemoPage() {
  if (!cohortEnabled()) notFound()
  const profile = await requireAuth()
  const supabase = await createClient()

  const { data: memberships } = await supabase
    .from('cohort_members').select('cohort:cohorts(id, name, course_id, status, demo_day_at)').eq('user_id', profile.id)
  const active = (memberships || []).find((m) => (m.cohort as unknown as { status: string } | null)?.status === 'active') || (memberships || [])[0]
  if (!active) {
    return <StudentLayout isAdmin={isAdmin(profile.role)}><div className="max-w-3xl mx-auto"><Card><CardBody><p className="text-sm text-gray-500">参加中の期がありません。</p></CardBody></Card></div></StudentLayout>
  }
  const cohort = active.cohort as unknown as { id: string; name: string; course_id: string; demo_day_at: string | null }
  const staff = isStaff(profile.role)

  const svc = await createServiceClient()
  const { data: entries } = await svc.from('demo_day_entries').select('id, user_id, title, description, video_url, demo_url').eq('cohort_id', cohort.id)
  const names = new Map<string, string>()
  const uids = (entries || []).map((e: { user_id: string }) => e.user_id)
  if (uids.length) { const { data: p } = await svc.from('profiles').select('id, name').in('id', uids); for (const x of p || []) names.set(x.id, x.name || '発表者') }
  const myEntry = (entries || []).find((e: { user_id: string }) => e.user_id === profile.id)

  const { data: skills } = await svc.from('skills').select('id, name, skill_map:skill_maps!inner(course_id)').eq('skill_map.course_id', cohort.course_id).order('order_index')
  const skillList = (skills || []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }))

  return (
    <StudentLayout isAdmin={isAdmin(profile.role)}>
      <div className="max-w-3xl mx-auto">
        <div className="mb-3"><Link href="/cohort" className="text-sm text-blue-600 hover:text-blue-700">&larr; {cohort.name}</Link></div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">デモデイ</h1>
        <p className="text-sm text-gray-500 mb-6">{cohort.demo_day_at ? `開催: ${new Date(cohort.demo_day_at).toLocaleString('ja-JP')}` : '作ったものを発表しましょう。'}</p>

        <Card className="mb-6">
          <CardHeader><h2 className="text-lg font-semibold">{myEntry ? 'あなたの発表' : '発表を登録'}</h2></CardHeader>
          <CardBody>
            <DemoEntryForm cohortId={cohort.id} initial={myEntry ? {
              title: myEntry.title, description: myEntry.description || '', videoUrl: myEntry.video_url || '', demoUrl: myEntry.demo_url || '',
            } : undefined} />
          </CardBody>
        </Card>

        <h2 className="text-lg font-semibold text-gray-800 mb-2">発表一覧</h2>
        <div className="space-y-3">
          {(entries || []).map((e: { id: string; user_id: string; title: string; description: string | null; video_url: string | null; demo_url: string | null }) => (
            <Card key={e.id}>
              <CardHeader><h3 className="text-sm font-semibold">{e.title}<span className="ml-2 text-xs text-gray-400">{names.get(e.user_id)}</span></h3></CardHeader>
              <CardBody>
                {e.description && <p className="text-sm text-gray-700 whitespace-pre-wrap">{e.description}</p>}
                <div className="mt-2 flex gap-3 text-sm">
                  {e.video_url && <a className="text-blue-600 underline" href={e.video_url} target="_blank" rel="noreferrer">デモ動画</a>}
                  {e.demo_url && <a className="text-blue-600 underline" href={e.demo_url} target="_blank" rel="noreferrer">デモ</a>}
                </div>
                {staff && e.user_id !== profile.id && (
                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2">講師評価（スキルに反映されます）</p>
                    <DemoEvalForm entryId={e.id} skills={skillList} />
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
          {(entries || []).length === 0 && <Card><CardBody><p className="text-sm text-gray-500">まだ発表がありません。</p></CardBody></Card>}
        </div>
      </div>
    </StudentLayout>
  )
}
