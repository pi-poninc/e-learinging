import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { aiCoachEnabled } from '@/lib/flags'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function CoachLogsPage() {
  if (!aiCoachEnabled()) notFound()
  await requireStaff()
  const supabase = await createClient()

  const { data: convs } = await supabase
    .from('coach_conversations')
    .select('id, flagged, updated_at, user:profiles(name), task:review_tasks(title)')
    .order('updated_at', { ascending: false }).limit(100)

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">AIコーチの会話ログ</h1>
      <p className="text-sm text-gray-500 mb-6">学習サポートの状況確認用。「要確認」は、答えの丸投げなどの兆候があった会話です（自動ブロックはしていません）。</p>

      {(!convs || convs.length === 0) && (
        <Card><CardBody><p className="text-sm text-gray-500">会話はまだありません。</p></CardBody></Card>
      )}

      <div className="space-y-2">
        {(convs || []).map((c) => {
          const u = c.user as unknown as { name: string | null } | null
          const t = c.task as unknown as { title: string } | null
          return (
            <Link key={c.id} href={`/admin/coach-logs/${c.id}`}>
              <Card className="hover:shadow-md transition-shadow"><CardBody>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-medium text-gray-900">{u?.name || '受講者'}</span>
                    <span className="text-sm text-gray-500 ml-2">{t?.title || '課題'}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.flagged && <Badge variant="danger">要確認</Badge>}
                    <span className="text-xs text-gray-400">{new Date(c.updated_at).toLocaleString('ja-JP')}</span>
                  </div>
                </div>
              </CardBody></Card>
            </Link>
          )
        })}
      </div>
    </AdminLayout>
  )
}
