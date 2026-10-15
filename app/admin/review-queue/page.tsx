import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { submissionReviewEnabled } from '@/lib/flags'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function ReviewQueuePage() {
  if (!submissionReviewEnabled()) notFound()
  await requireStaff()
  const supabase = await createClient()

  // 60分以上「確保」のまま編集がないものを自動解放
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  await supabase.from('review_feedback').delete().eq('status', 'claimed').lt('claimed_at', cutoff)
  const { data: fbRows } = await supabase.from('review_feedback').select('submission_id')
  const claimedSet = new Set((fbRows || []).map((f) => f.submission_id))
  const { data: inrev } = await supabase.from('review_submissions').select('id').eq('status', 'in_review')
  const orphans = (inrev || []).filter((s) => !claimedSet.has(s.id)).map((s) => s.id)
  if (orphans.length) await supabase.from('review_submissions').update({ status: 'submitted' }).in('id', orphans)

  // キュー：未公開の提出を期限が近い順
  const { data: rows } = await supabase
    .from('review_submissions')
    .select('id, status, submitted_at, sla_due_at, submission_number, task:review_tasks(title), user:profiles(name)')
    .in('status', ['submitted', 'in_review'])
    .order('sla_due_at', { ascending: true })
    .limit(200)

  const now = Date.now()
  const fmtRemain = (due: string | null) => {
    if (!due) return { label: '—', variant: 'default' as const }
    const ms = new Date(due).getTime() - now
    const h = ms / 3600000
    const label = ms < 0 ? `期限超過 ${Math.ceil(-h)}h` : `残り ${Math.floor(h)}h${Math.floor((ms % 3600000) / 60000)}m`
    const variant = ms < 0 ? ('danger' as const) : h <= 3 ? ('warning' as const) : ('default' as const)
    return { label, variant }
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">添削キュー</h1>
      <p className="text-sm text-gray-500 mb-6">返却期限が近い順。初期（1〜5回目）の受講者は丁寧に添削しましょう。</p>

      {(!rows || rows.length === 0) && (
        <Card><CardBody><p className="text-sm text-gray-500">未添削の提出はありません。</p></CardBody></Card>
      )}

      <div className="space-y-2">
        {(rows || []).map((r) => {
          const remain = fmtRemain(r.sla_due_at)
          const task = r.task as unknown as { title: string } | null
          const u = r.user as unknown as { name: string | null } | null
          const early = (r.submission_number || 99) <= 5
          return (
            <Link key={r.id} href={`/admin/review-queue/${r.id}`}>
              <Card className="hover:shadow-md transition-shadow">
                <CardBody>
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{task?.title || '課題'}</p>
                      <p className="text-xs text-gray-500">
                        {u?.name || '受講者'}・{r.submitted_at ? new Date(r.submitted_at).toLocaleString('ja-JP') : ''}
                        {early && <span className="ml-2 text-orange-600 font-medium">初期</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.status === 'in_review' && <Badge variant="info">添削中</Badge>}
                      <Badge variant={remain.variant}>{remain.label}</Badge>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Link>
          )
        })}
      </div>
    </AdminLayout>
  )
}
