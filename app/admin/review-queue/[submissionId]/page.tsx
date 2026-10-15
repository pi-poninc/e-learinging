import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { submissionReviewEnabled } from '@/lib/flags'
import { getReviewSettings } from '@/lib/review/service'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ReviewEditor } from '@/components/review/review-editor'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface Props { params: Promise<{ submissionId: string }> }

export default async function ReviewEditorPage({ params }: Props) {
  if (!submissionReviewEnabled()) notFound()
  const { submissionId } = await params
  const me = await requireStaff()
  const supabase = await createClient()

  const { data: sub } = await supabase
    .from('review_submissions')
    .select('*, task:review_tasks(title, instructions, rubric_id), user:profiles(name)')
    .eq('id', submissionId)
    .maybeSingle()
  if (!sub) notFound()
  const task = sub.task as unknown as { title: string; instructions: string | null; rubric_id: string | null } | null
  const u = sub.user as unknown as { name: string | null } | null

  // ルーブリック項目（スキルマップ機能が有効なとき）
  let rubricItems: { id: string; label: string; max_level: number }[] = []
  if (task?.rubric_id) {
    const { data: items } = await supabase
      .from('rubric_items')
      .select('id, label, max_level, order_index')
      .eq('rubric_id', task.rubric_id)
      .order('order_index')
    rubricItems = (items || []).map((i) => ({ id: i.id, label: i.label, max_level: i.max_level }))
  }

  const { data: fb } = await supabase
    .from('review_feedback')
    .select('reviewer_id, status, good_points, improvements, next_action, is_exemplar')
    .eq('submission_id', submissionId)
    .maybeSingle()
  const settings = await getReviewSettings(supabase, sub.course_id)

  const claimedByMe = !!fb && fb.reviewer_id === me.id && fb.status !== 'published'
  const claimedByOther = !!fb && fb.reviewer_id !== me.id && fb.status !== 'published'
  const published = !!fb && fb.status === 'published'

  // 受講者の過去の提出・添削（前回指摘が直っているか確認用）
  const { data: history } = await supabase
    .from('review_submissions')
    .select('id, submitted_at, status')
    .eq('user_id', sub.user_id)
    .eq('task_id', sub.task_id)
    .neq('id', submissionId)
    .order('submitted_at', { ascending: false })
    .limit(5)

  return (
    <AdminLayout>
      <div className="mb-4">
        <Link href="/admin/review-queue" className="text-sm text-blue-600 hover:text-blue-700">&larr; 添削キューに戻る</Link>
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">{task?.title || '課題'}</h1>
      <p className="text-sm text-gray-500 mb-4">
        {u?.name || '受講者'}・累計{sub.submission_number ?? '—'}回目
        {(sub.submission_number || 99) <= 5 && <span className="ml-2 text-orange-600 font-medium">初期（良かった点を厚めに）</span>}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左：提出物 */}
        <div className="space-y-4">
          {task?.instructions && (
            <Card><CardHeader><h2 className="text-sm font-semibold text-gray-600">課題</h2></CardHeader>
              <CardBody><div className="prose max-w-none text-sm" dangerouslySetInnerHTML={{ __html: String(task.instructions).replace(/\n/g, '<br>') }} /></CardBody>
            </Card>
          )}
          <Card>
            <CardHeader><h2 className="text-sm font-semibold text-gray-600">提出物</h2></CardHeader>
            <CardBody>
              {sub.content_text && <p className="whitespace-pre-wrap text-sm text-gray-800">{sub.content_text}</p>}
              {sub.content_url && <p className="text-sm mt-2"><a className="text-blue-600 underline" href={sub.content_url} target="_blank" rel="noreferrer">{sub.content_url}</a></p>}
              {!sub.content_text && !sub.content_url && <p className="text-sm text-gray-400">（内容なし）</p>}
              {sub.submitted_at && <p className="text-xs text-gray-400 mt-3">提出: {new Date(sub.submitted_at).toLocaleString('ja-JP')}</p>}
            </CardBody>
          </Card>
          {history && history.length > 0 && (
            <Card>
              <CardHeader><h2 className="text-sm font-semibold text-gray-600">この課題の過去の提出</h2></CardHeader>
              <CardBody>
                <ul className="text-xs text-gray-500 space-y-1">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-center gap-2">
                      <Badge variant={h.status === 'reviewed' ? 'success' : 'default'}>{h.status}</Badge>
                      {h.submitted_at ? new Date(h.submitted_at).toLocaleString('ja-JP') : ''}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>

        {/* 右：添削フォーム */}
        <div>
          <Card>
            <CardHeader><h2 className="text-sm font-semibold text-gray-600">添削（良かった点 → 改善点 → 次にやること）</h2></CardHeader>
            <CardBody>
              <ReviewEditor
                submissionId={submissionId}
                claimedByMe={claimedByMe}
                claimedByOther={claimedByOther}
                published={published}
                rubricItems={rubricItems}
                aiDraftEnabled={settings.aiDraftEnabled}
                isExemplar={!!fb?.is_exemplar}
                initial={fb ? { good: fb.good_points || '', improvements: fb.improvements || '', next: fb.next_action || '' } : undefined}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
