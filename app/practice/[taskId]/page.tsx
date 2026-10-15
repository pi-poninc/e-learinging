import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/permissions'
import { submissionReviewEnabled } from '@/lib/flags'
import { getReviewSettings } from '@/lib/review/service'
import { learningDay, nextSubmitAt } from '@/lib/learning-day'
import { StudentLayout } from '@/components/layouts/student-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ReviewSubmitForm } from '@/components/review/submit-form'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

interface Props { params: Promise<{ taskId: string }> }

export default async function PracticeTaskPage({ params }: Props) {
  if (!submissionReviewEnabled()) notFound()
  const { taskId } = await params
  const profile = await requireAuth()
  const supabase = await createClient()

  const { data: task } = await supabase
    .from('review_tasks')
    .select('*, course:courses(id, title)')
    .eq('id', taskId)
    .maybeSingle()
  if (!task || !task.is_active) notFound()
  const course = task.course as unknown as { id: string; title: string }

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('user_id', profile.id)
    .eq('course_id', task.course_id)
    .eq('status', 'active')
    .maybeSingle()
  if (!enrollment) redirect('/dashboard')

  const settings = await getReviewSettings(supabase, task.course_id)
  const now = new Date()
  const today = learningDay(now, { timezone: settings.timezone, dayBoundaryHour: settings.dayBoundaryHour })

  // 本日このコースで提出済みか（コース単位の日次上限）
  const { count: todayCount } = await supabase
    .from('review_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('course_id', task.course_id)
    .eq('learning_day', today)
    .neq('status', 'draft')
  const alreadyToday = (todayCount || 0) > 0

  // この課題の最新提出
  const { data: subs } = await supabase
    .from('review_submissions')
    .select('*')
    .eq('user_id', profile.id)
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(1)
  const latest = subs?.[0]

  // 添削結果（公開済み）
  let feedback: { good_points: string | null; improvements: string | null; next_action: string | null; reviewer_id: string } | null = null
  let reviewerName = '添削者'
  if (latest) {
    const { data: fb } = await supabase
      .from('review_feedback')
      .select('good_points, improvements, next_action, reviewer_id, status')
      .eq('submission_id', latest.id)
      .eq('status', 'published')
      .maybeSingle()
    if (fb) {
      feedback = fb
      const { data: rp } = await supabase.from('reviewer_profiles').select('display_name').eq('user_id', fb.reviewer_id).maybeSingle()
      if (rp?.display_name) reviewerName = rp.display_name
    }
  }

  const statusLabel: Record<string, string> = {
    submitted: '提出済み（添削待ち）', in_review: '添削中', reviewed: '添削返却済み',
    returned_for_resubmission: '再提出のお願い', draft: '下書き',
  }

  return (
    <StudentLayout isAdmin={isAdmin(profile.role)}>
      <div className="mb-4">
        <Link href="/practice" className="text-sm text-blue-600 hover:text-blue-700">&larr; 練習一覧に戻る</Link>
      </div>
      <div className="max-w-3xl mx-auto">
        <p className="text-sm text-gray-500">{course.title}</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{task.title}</h1>

        {task.instructions && (
          <Card className="mb-6"><CardBody>
            <div className="prose max-w-none text-sm" dangerouslySetInnerHTML={{ __html: String(task.instructions).replace(/\n/g, '<br>') }} />
          </CardBody></Card>
        )}

        {/* 添削結果 */}
        {feedback && (
          <Card className="mb-6">
            <CardHeader><h2 className="text-lg font-semibold">添削が返ってきました（{reviewerName} より）</h2></CardHeader>
            <CardBody>
              <div className="space-y-3 text-sm">
                <div><p className="font-semibold text-green-700">良かった点</p><p className="whitespace-pre-wrap text-gray-700">{feedback.good_points}</p></div>
                {feedback.improvements && <div><p className="font-semibold text-amber-700">改善点</p><p className="whitespace-pre-wrap text-gray-700">{feedback.improvements}</p></div>}
                <div><p className="font-semibold text-blue-700">次にやること</p><p className="whitespace-pre-wrap text-gray-700">{feedback.next_action}</p></div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* 最新提出の状態 */}
        {latest && (
          <Card className="mb-6">
            <CardHeader><div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">直近の提出</h2>
              <Badge variant={latest.status === 'reviewed' ? 'success' : 'info'}>{statusLabel[latest.status] || latest.status}</Badge>
            </div></CardHeader>
            <CardBody>
              {latest.content_text && <p className="whitespace-pre-wrap text-sm text-gray-700">{latest.content_text}</p>}
              {latest.content_url && <p className="text-sm mt-1"><a className="text-blue-600 underline" href={latest.content_url} target="_blank" rel="noreferrer">{latest.content_url}</a></p>}
              {latest.submitted_at && <p className="text-xs text-gray-400 mt-2">提出: {new Date(latest.submitted_at).toLocaleString('ja-JP')}</p>}
            </CardBody>
          </Card>
        )}

        {/* 提出フォーム or 本日完了 */}
        {alreadyToday ? (
          <Card><CardBody>
            <p className="text-sm text-gray-700">今日の提出は完了しています。添削をお待ちください。</p>
            <p className="text-xs text-gray-400 mt-1">次に提出できるのは {nextSubmitAt(now, { timezone: settings.timezone, dayBoundaryHour: settings.dayBoundaryHour }).toLocaleString('ja-JP')} 以降です。</p>
          </CardBody></Card>
        ) : (
          <Card>
            <CardHeader><h2 className="text-lg font-semibold">今日の分を提出</h2></CardHeader>
            <CardBody>
              <ReviewSubmitForm taskId={taskId} submissionTypes={task.submission_types as string[]} encouragement={settings.submitEncouragement} />
            </CardBody>
          </Card>
        )}
      </div>
    </StudentLayout>
  )
}
