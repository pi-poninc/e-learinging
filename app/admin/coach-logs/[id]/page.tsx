import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { aiCoachEnabled } from '@/lib/flags'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface Props { params: Promise<{ id: string }> }

export default async function CoachLogDetailPage({ params }: Props) {
  if (!aiCoachEnabled()) notFound()
  const { id } = await params
  await requireStaff()
  const supabase = await createClient()

  const { data: conv } = await supabase
    .from('coach_conversations').select('id, flagged, user:profiles(name), task:review_tasks(title)').eq('id', id).maybeSingle()
  if (!conv) notFound()
  const u = conv.user as unknown as { name: string | null } | null
  const t = conv.task as unknown as { title: string } | null

  const { data: msgs } = await supabase
    .from('coach_messages').select('role, content, created_at').eq('conversation_id', id).order('created_at', { ascending: true })

  return (
    <AdminLayout>
      <div className="mb-4"><Link href="/admin/coach-logs" className="text-sm text-blue-600 hover:text-blue-700">&larr; 会話ログ一覧</Link></div>
      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-xl font-bold text-gray-900">{u?.name || '受講者'}・{t?.title || '課題'}</h1>
        {conv.flagged && <Badge variant="danger">要確認</Badge>}
      </div>
      <Card><CardBody>
        <div className="space-y-3">
          {(msgs || []).map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-blue-50 text-gray-800' : 'bg-gray-100 text-gray-800'}`}>
                <div className="text-[10px] text-gray-400 mb-0.5">{m.role === 'user' ? '受講者' : 'AIコーチ'}</div>
                {m.content}
              </div>
            </div>
          ))}
          {(!msgs || msgs.length === 0) && <p className="text-sm text-gray-400">メッセージはありません。</p>}
        </div>
      </CardBody></Card>
    </AdminLayout>
  )
}
