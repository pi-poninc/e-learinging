import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/permissions'
import { aiCoachEnabled } from '@/lib/flags'
import { getReviewSettings } from '@/lib/review/service'
import { StudentLayout } from '@/components/layouts/student-layout'
import { Card, CardBody } from '@/components/ui/card'
import { CoachChat } from '@/components/review/coach-chat'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

interface Props { params: Promise<{ taskId: string }> }

export default async function CoachPage({ params }: Props) {
  if (!aiCoachEnabled()) notFound()
  const { taskId } = await params
  const profile = await requireAuth()
  const supabase = await createClient()

  const { data: task } = await supabase.from('review_tasks').select('id, title, course_id').eq('id', taskId).maybeSingle()
  if (!task) notFound()
  const { data: enr } = await supabase.from('enrollments').select('id').eq('user_id', profile.id).eq('course_id', task.course_id).eq('status', 'active').maybeSingle()
  if (!enr) redirect('/dashboard')

  const settings = await getReviewSettings(supabase, task.course_id)

  let initial: { role: 'user' | 'assistant'; content: string }[] = []
  const { data: conv } = await supabase.from('coach_conversations').select('id').eq('user_id', profile.id).eq('task_id', taskId).maybeSingle()
  if (conv) {
    const { data: msgs } = await supabase.from('coach_messages').select('role, content').eq('conversation_id', conv.id).order('created_at', { ascending: true })
    initial = (msgs || []) as { role: 'user' | 'assistant'; content: string }[]
  }

  return (
    <StudentLayout isAdmin={isAdmin(profile.role)}>
      <div className="mb-4">
        <Link href={`/practice/${taskId}`} className="text-sm text-blue-600 hover:text-blue-700">&larr; 課題に戻る</Link>
      </div>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">AIコーチ</h1>
        <p className="text-sm text-gray-500 mb-2">「{task.title}」の相談相手です。答えは渡しませんが、考えを一緒に整理します。</p>
        <p className="text-xs text-gray-400 mb-4">※ この会話は学習サポートのため講師が確認できます。1日の利用上限は {settings.aiCoachDailyLimit} 回です。</p>

        {settings.aiCoachEnabled ? (
          <CoachChat taskId={taskId} initial={initial} />
        ) : (
          <Card><CardBody><p className="text-sm text-gray-500">このコースではAIコーチは有効になっていません。</p></CardBody></Card>
        )}
      </div>
    </StudentLayout>
  )
}
