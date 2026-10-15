import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/permissions'
import { peerReviewEnabled } from '@/lib/flags'
import { StudentLayout } from '@/components/layouts/student-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { PeerForm } from '@/components/review/peer-form'
import { ActionButton } from '@/components/review/action-button'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function PeerQueuePage() {
  if (!peerReviewEnabled()) notFound()
  const profile = await requireAuth()
  const supabase = await createClient()

  const { data: assigned } = await supabase
    .from('peer_reviews')
    .select('id, submission:review_submissions(content_text, content_url, task:review_tasks(title))')
    .eq('reviewer_id', profile.id).eq('status', 'assigned')

  const { count: doneCount } = await supabase
    .from('peer_reviews').select('id', { count: 'exact', head: true }).eq('reviewer_id', profile.id).eq('status', 'submitted')

  return (
    <StudentLayout isAdmin={isAdmin(profile.role)}>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">ピアレビュー（仲間の添削）</h1>
        <p className="text-sm text-gray-500 mb-4">自分も提出した課題について、仲間の提出にコメントを送ります。教えることも学びのうち。これまで {doneCount ?? 0} 件。</p>

        <div className="mb-6">
          <ActionButton endpoint="/api/review/peer" body={{ action: 'claim' }} label="＋ ピアレビューを引き受ける" />
        </div>

        {(!assigned || assigned.length === 0) && (
          <Card><CardBody><p className="text-sm text-gray-500">割り当て中のピアレビューはありません。「引き受ける」で受け取れます（対象が無い場合もあります）。</p></CardBody></Card>
        )}

        <div className="space-y-4">
          {(assigned || []).map((a) => {
            const sub = a.submission as unknown as { content_text: string | null; content_url: string | null; task: { title: string } | null } | null
            return (
              <Card key={a.id}>
                <CardHeader><h2 className="text-sm font-semibold">{sub?.task?.title || '課題'}（仲間の提出）</h2></CardHeader>
                <CardBody>
                  <div className="rounded bg-gray-50 p-3 text-sm mb-4">
                    {sub?.content_text && <p className="whitespace-pre-wrap text-gray-700">{sub.content_text}</p>}
                    {sub?.content_url && <p className="mt-1"><a className="text-blue-600 underline" href={sub.content_url} target="_blank" rel="noreferrer">{sub.content_url}</a></p>}
                    {!sub?.content_text && !sub?.content_url && <p className="text-gray-400">（本文なし）</p>}
                  </div>
                  <PeerForm peerReviewId={a.id} />
                </CardBody>
              </Card>
            )
          })}
        </div>

        <div className="mt-6"><Link href="/practice" className="text-sm text-blue-600 hover:text-blue-700">&larr; 練習一覧に戻る</Link></div>
      </div>
    </StudentLayout>
  )
}
