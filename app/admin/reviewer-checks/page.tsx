import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { peerReviewEnabled } from '@/lib/flags'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { ActionButton } from '@/components/review/action-button'
import { notFound } from 'next/navigation'

export default async function ReviewerChecksPage() {
  if (!peerReviewEnabled()) notFound()
  await requireStaff()
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('review_feedback')
    .select('submission_id, good_points, improvements, next_action, reviewer:profiles!review_feedback_reviewer_id_fkey(name), submission:review_submissions(task:review_tasks(title), content_text)')
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: true })

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">新任添削者の確認</h1>
      <p className="text-sm text-gray-500 mb-6">新しく認定した添削者の最初の添削です。公開前に内容を確認してください。</p>

      {(!rows || rows.length === 0) && (
        <Card><CardBody><p className="text-sm text-gray-500">確認待ちの添削はありません。</p></CardBody></Card>
      )}

      <div className="space-y-3">
        {(rows || []).map((r) => {
          const rev = r.reviewer as unknown as { name: string | null } | null
          const sub = r.submission as unknown as { task: { title: string } | null; content_text: string | null } | null
          return (
            <Card key={r.submission_id}>
              <CardHeader><div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">{sub?.task?.title || '課題'}（添削者: {rev?.name || '—'}）</h2>
              </div></CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="rounded bg-gray-50 p-3">
                    <p className="text-xs text-gray-400 mb-1">提出物</p>
                    <p className="whitespace-pre-wrap text-gray-700">{sub?.content_text || '（本文なし）'}</p>
                  </div>
                  <div className="space-y-2">
                    <div><p className="font-semibold text-green-700">良かった点</p><p className="whitespace-pre-wrap text-gray-700">{r.good_points}</p></div>
                    {r.improvements && <div><p className="font-semibold text-amber-700">改善点</p><p className="whitespace-pre-wrap text-gray-700">{r.improvements}</p></div>}
                    <div><p className="font-semibold text-blue-700">次にやること</p><p className="whitespace-pre-wrap text-gray-700">{r.next_action}</p></div>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <ActionButton endpoint="/api/review/veteran" body={{ submissionId: r.submission_id, action: 'approve' }} label="確認して公開" />
                  <ActionButton endpoint="/api/review/veteran" body={{ submissionId: r.submission_id, action: 'request_changes' }} label="修正を依頼" variant="ghost" />
                </div>
              </CardBody>
            </Card>
          )
        })}
      </div>
    </AdminLayout>
  )
}
