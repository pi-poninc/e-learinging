import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { submissionReviewEnabled } from '@/lib/flags'

// 時間制限課題の「開始」を記録する。開始後に教材が公開され、残り時間の計測が始まる。
export async function POST(request: NextRequest) {
  if (!submissionReviewEnabled()) return NextResponse.json({ error: '機能が無効です' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { taskId } = await request.json()
  if (!taskId) return NextResponse.json({ error: 'taskId が必要です' }, { status: 400 })

  const { data: task } = await supabase
    .from('review_tasks')
    .select('id, course_id, assignment_type, is_active')
    .eq('id', taskId)
    .maybeSingle()
  if (!task || !task.is_active) return NextResponse.json({ error: '課題が見つかりません' }, { status: 404 })
  if (task.assignment_type !== 'timed_challenge') {
    return NextResponse.json({ error: 'この課題は開始操作が不要です' }, { status: 400 })
  }

  const { data: enrollment } = await supabase
    .from('enrollments').select('id').eq('user_id', user.id).eq('course_id', task.course_id).eq('status', 'active').maybeSingle()
  if (!enrollment) return NextResponse.json({ error: 'この講座を受講していません' }, { status: 403 })

  // すでに開始済みなら、その開始時刻を返す（再開始させない）
  const { data: existing } = await supabase
    .from('review_task_starts').select('started_at').eq('task_id', taskId).eq('user_id', user.id).maybeSingle()
  if (existing) return NextResponse.json({ startedAt: existing.started_at, already: true })

  const { data, error } = await supabase
    .from('review_task_starts')
    .insert({ task_id: taskId, user_id: user.id })
    .select('started_at')
    .single()
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      const { data: again } = await supabase.from('review_task_starts').select('started_at').eq('task_id', taskId).eq('user_id', user.id).maybeSingle()
      return NextResponse.json({ startedAt: again?.started_at, already: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ startedAt: data.started_at })
}
