import { requireAuth } from '@/lib/auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/permissions'
import { submissionReviewEnabled } from '@/lib/flags'
import { getReviewSettings } from '@/lib/review/service'
import { learningDay, nextSubmitAt } from '@/lib/learning-day'
import { StudentLayout } from '@/components/layouts/student-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ReviewSubmitForm } from '@/components/review/submit-form'
import { TimedStart } from '@/components/review/timed-start'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

interface Props { params: Promise<{ taskId: string }> }

const TYPE_LABEL: Record<string, string> = {
  drill: '基礎ドリル', case: 'ケース課題', timed_challenge: '時間制限課題', ojt: 'OJT', peer_review: 'ピアレビュー',
}

export default async function PracticeTaskPage({ params }: Props) {
  if (!submissionReviewEnabled()) notFound()
  const { taskId } = await params
  const profile = await requireAuth()
  const supabase = await createClient()

  const { data: task } = await supabase
    .from('review_tasks').select('*, course:courses(id, title)').eq('id', taskId).maybeSingle()
  if (!task || !task.is_active) notFound()
  const course = task.course as unknown as { id: string; title: string }

  const { data: enrollment } = await supabase
    .from('enrollments').select('id').eq('user_id', profile.id).eq('course_id', task.course_id).eq('status', 'active').maybeSingle()
  if (!enrollment) redirect('/dashboard')

  // 前提グレードのロック
  let locked = false
  let prereqName: string | null = null
  if (task.prerequisite_grade_id) {
    const { data: preq } = await supabase.from('grades').select('level, name, course_id').eq('id', task.prerequisite_grade_id).maybeSingle()
    if (preq) {
      prereqName = preq.name
      const { data: approvedUg } = await supabase.from('user_grades').select('grade_id').eq('user_id', profile.id).eq('status', 'approved')
      const ids = (approvedUg || []).map((g) => g.grade_id)
      let maxApproved = 0
      if (ids.length) {
        const { data: gr } = await supabase.from('grades').select('level').in('id', ids).eq('course_id', preq.course_id)
        maxApproved = Math.max(0, ...(gr || []).map((g) => g.level))
      }
      locked = maxApproved < preq.level
    }
  }

  const settings = await getReviewSettings(supabase, task.course_id)
  const now = new Date()
  const today = learningDay(now, { timezone: settings.timezone, dayBoundaryHour: settings.dayBoundaryHour })

  const { count: todayCount } = await supabase
    .from('review_submissions').select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id).eq('course_id', task.course_id).eq('learning_day', today).neq('status', 'draft')
  const alreadyToday = (todayCount || 0) > 0

  const { data: subs } = await supabase
    .from('review_submissions').select('*').eq('user_id', profile.id).eq('task_id', taskId)
    .order('created_at', { ascending: false }).limit(1)
  const latest = subs?.[0]

  // 時間制限課題の開始状態
  const isTimed = task.assignment_type === 'timed_challenge'
  let startedAt: string | null = null
  if (isTimed) {
    const { data: st } = await supabase.from('review_task_starts').select('started_at').eq('task_id', taskId).eq('user_id', profile.id).maybeSingle()
    startedAt = st?.started_at ?? null
  }
  const revealed = !isTimed || !!startedAt  // 時間制限は開始後に教材公開

  // ケース教材（承認済みのみ閲覧可・公開済みのとき）
  let caseMaterial: { title: string; background: string | null; materials: { type?: string; name?: string }[] } | null = null
  if (task.case_material_id && revealed && !locked) {
    const { data: cm } = await supabase.from('case_materials').select('title, background, materials').eq('id', task.case_material_id).maybeSingle()
    if (cm) caseMaterial = cm
  }
  // 模範解答は、提出して添削が返却されたあとにだけ開示
  let modelAnswer: string | null = null
  if (task.case_material_id && latest?.status === 'reviewed') {
    const svc = await createServiceClient()
    const { data: priv } = await svc.from('case_material_private').select('model_answer').eq('case_material_id', task.case_material_id).maybeSingle()
    modelAnswer = priv?.model_answer || null
  }

  // 添削結果
  let feedback: { good_points: string | null; improvements: string | null; next_action: string | null; reviewer_id: string } | null = null
  let reviewerName = '添削者'
  if (latest) {
    const { data: fb } = await supabase
      .from('review_feedback').select('good_points, improvements, next_action, reviewer_id, status')
      .eq('submission_id', latest.id).eq('status', 'published').maybeSingle()
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
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="info">{TYPE_LABEL[task.assignment_type] || task.assignment_type}</Badge>
          {task.difficulty_level && <span className="text-xs text-gray-400">難易度 {task.difficulty_level}/5</span>}
        </div>
        <p className="text-sm text-gray-500">{course.title}</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{task.title}</h1>

        {locked ? (
          <Card><CardBody>
            <p className="text-sm text-gray-700">🔒 この課題は <span className="font-medium">{prereqName}</span> グレードの承認後に解放されます。</p>
          </CardBody></Card>
        ) : (
          <>
            {isTimed && (
              <div className="mb-6">
                <TimedStart taskId={taskId} startedAt={startedAt} timeLimitMinutes={task.time_limit_minutes} />
              </div>
            )}

            {revealed && task.instructions && (
              <Card className="mb-6"><CardBody>
                <div className="prose max-w-none text-sm" dangerouslySetInnerHTML={{ __html: String(task.instructions).replace(/\n/g, '<br>') }} />
              </CardBody></Card>
            )}

            {caseMaterial && (
              <Card className="mb-6">
                <CardHeader><h2 className="text-lg font-semibold">ケース教材：{caseMaterial.title}</h2></CardHeader>
                <CardBody>
                  {caseMaterial.background && <p className="whitespace-pre-wrap text-sm text-gray-700">{caseMaterial.background}</p>}
                  {Array.isArray(caseMaterial.materials) && caseMaterial.materials.length > 0 && (
                    <ul className="mt-3 text-sm text-gray-600 list-disc pl-5">
                      {caseMaterial.materials.map((m, i) => <li key={i}>{m.name || m.type || '資料'}</li>)}
                    </ul>
                  )}
                </CardBody>
              </Card>
            )}

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

            {modelAnswer && (
              <Card className="mb-6">
                <CardHeader><h2 className="text-lg font-semibold">模範解答・講評のポイント</h2></CardHeader>
                <CardBody><p className="whitespace-pre-wrap text-sm text-gray-700">{modelAnswer}</p></CardBody>
              </Card>
            )}

            {latest && (
              <Card className="mb-6">
                <CardHeader><div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">直近の提出</h2>
                  <div className="flex items-center gap-2">
                    {latest.auto_check_result?.overtime && <Badge variant="warning">時間超過</Badge>}
                    <Badge variant={latest.status === 'reviewed' ? 'success' : 'info'}>{statusLabel[latest.status] || latest.status}</Badge>
                  </div>
                </div></CardHeader>
                <CardBody>
                  {latest.content_text && <p className="whitespace-pre-wrap text-sm text-gray-700">{latest.content_text}</p>}
                  {latest.content_url && <p className="text-sm mt-1"><a className="text-blue-600 underline" href={latest.content_url} target="_blank" rel="noreferrer">{latest.content_url}</a></p>}
                  {latest.submitted_at && <p className="text-xs text-gray-400 mt-2">提出: {new Date(latest.submitted_at).toLocaleString('ja-JP')}</p>}
                </CardBody>
              </Card>
            )}

            {alreadyToday ? (
              <Card><CardBody>
                <p className="text-sm text-gray-700">今日の提出は完了しています。添削をお待ちください。</p>
                <p className="text-xs text-gray-400 mt-1">次に提出できるのは {nextSubmitAt(now, { timezone: settings.timezone, dayBoundaryHour: settings.dayBoundaryHour }).toLocaleString('ja-JP')} 以降です。</p>
              </CardBody></Card>
            ) : revealed ? (
              <Card>
                <CardHeader><h2 className="text-lg font-semibold">今日の分を提出</h2></CardHeader>
                <CardBody>
                  <ReviewSubmitForm taskId={taskId} submissionTypes={task.submission_types as string[]} encouragement={settings.submitEncouragement} />
                </CardBody>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </StudentLayout>
  )
}
