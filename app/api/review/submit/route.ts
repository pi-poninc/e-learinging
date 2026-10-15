import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { submissionReviewEnabled } from '@/lib/flags'
import { getReviewSettings } from '@/lib/review/service'
import { learningDay, slaDueAt } from '@/lib/learning-day'

export async function POST(request: NextRequest) {
  if (!submissionReviewEnabled()) return NextResponse.json({ error: '機能が無効です' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { taskId, contentText, contentUrl } = await request.json()
  if (!taskId) return NextResponse.json({ error: 'taskId が必要です' }, { status: 400 })
  if (!contentText && !contentUrl) {
    return NextResponse.json({ error: '提出内容が空です' }, { status: 400 })
  }

  const { data: task } = await supabase
    .from('review_tasks')
    .select('id, course_id, is_active')
    .eq('id', taskId)
    .maybeSingle()
  if (!task || !task.is_active) return NextResponse.json({ error: '課題が見つかりません' }, { status: 404 })

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', task.course_id)
    .eq('status', 'active')
    .maybeSingle()
  if (!enrollment) return NextResponse.json({ error: 'この講座を受講していません' }, { status: 403 })

  const settings = await getReviewSettings(supabase, task.course_id)
  const now = new Date()
  const ld = learningDay(now, { timezone: settings.timezone, dayBoundaryHour: settings.dayBoundaryHour })

  const { count } = await supabase
    .from('review_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('course_id', task.course_id)
    .neq('status', 'draft')
  const submissionNumber = (count || 0) + 1

  const { data, error } = await supabase
    .from('review_submissions')
    .insert({
      task_id: taskId,
      course_id: task.course_id,
      user_id: user.id,
      status: 'submitted',
      content_text: contentText || null,
      content_url: contentUrl || null,
      learning_day: ld,
      submitted_at: now.toISOString(),
      sla_due_at: slaDueAt(now, settings.slaHours).toISOString(),
      submission_number: submissionNumber,
    })
    .select()
    .single()

  if (error) {
    // 二重送信 / 本日分すでに提出（部分unique index 違反）
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: '本日の提出はすでに完了しています', alreadySubmitted: true }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ submission: data, submissionNumber, slaHours: settings.slaHours })
}
