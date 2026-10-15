import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { aiCoachEnabled } from '@/lib/flags'
import { getReviewSettings } from '@/lib/review/service'
import { buildCoachSystemPrompt, detectDumpRequest } from '@/lib/review/coach'

const MODEL = process.env.ANTHROPIC_COACH_MODEL || 'claude-sonnet-5-5'

export async function POST(request: NextRequest) {
  if (!aiCoachEnabled()) return NextResponse.json({ error: '機能が無効です' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { taskId, message } = await request.json()
  if (!taskId || !message?.trim()) return NextResponse.json({ error: 'taskId と message が必要です' }, { status: 400 })

  const { data: task } = await supabase
    .from('review_tasks').select('id, course_id, title, assignment_type, course:courses(title)').eq('id', taskId).maybeSingle()
  if (!task) return NextResponse.json({ error: '課題が見つかりません' }, { status: 404 })

  const { data: enr } = await supabase.from('enrollments').select('id').eq('user_id', user.id).eq('course_id', task.course_id).eq('status', 'active').maybeSingle()
  if (!enr) return NextResponse.json({ error: 'この講座を受講していません' }, { status: 403 })

  const settings = await getReviewSettings(supabase, task.course_id)
  if (!settings.aiCoachEnabled) return NextResponse.json({ error: 'このコースではAIコーチは使えません' }, { status: 403 })

  // 時間制限課題の実施中は使えない
  if (task.assignment_type === 'timed_challenge') {
    const { data: start } = await supabase.from('review_task_starts').select('started_at').eq('task_id', taskId).eq('user_id', user.id).maybeSingle()
    if (start) {
      const { count: sub } = await supabase.from('review_submissions').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('task_id', taskId).neq('status', 'draft')
      if (!sub) return NextResponse.json({ error: '時間制限課題の実施中はAIコーチを使えません' }, { status: 403 })
    }
  }

  // 1日の利用上限
  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0)
  const { data: myConvs } = await supabase.from('coach_conversations').select('id').eq('user_id', user.id)
  const convIds = (myConvs || []).map((c) => c.id)
  let usedToday = 0
  if (convIds.length) {
    const { count } = await supabase.from('coach_messages').select('id', { count: 'exact', head: true })
      .in('conversation_id', convIds).eq('role', 'user').gte('created_at', startOfDay.toISOString())
    usedToday = count || 0
  }
  if (usedToday >= settings.aiCoachDailyLimit) {
    return NextResponse.json({ error: `本日の利用上限（${settings.aiCoachDailyLimit}回）に達しました。明日また相談できます。` }, { status: 429 })
  }

  // 会話（課題ごとに1つ）
  const { data: existingConv } = await supabase.from('coach_conversations').select('id').eq('user_id', user.id).eq('task_id', taskId).maybeSingle()
  let conversationId = existingConv?.id
  if (!conversationId) {
    const { data: created } = await supabase.from('coach_conversations').insert({ user_id: user.id, course_id: task.course_id, task_id: taskId }).select('id').single()
    conversationId = created?.id
  }
  if (!conversationId) return NextResponse.json({ error: '会話を作成できませんでした' }, { status: 500 })

  // コンテキスト（個人情報は渡さない：スキルは数値のみ）
  let skillLevels = '（まだ評価なし）'
  const { data: levels } = await supabase
    .from('user_skill_levels').select('current_level, skill:skills(name)').eq('user_id', user.id)
  if (levels && levels.length) {
    skillLevels = levels.map((l) => `${(l.skill as unknown as { name: string } | null)?.name || 'スキル'}:${l.current_level}`).join(', ')
  }
  let latestNextAction = '（なし）'
  const { data: lastSub } = await supabase.from('review_submissions').select('id').eq('user_id', user.id).eq('task_id', taskId).eq('status', 'reviewed').order('created_at', { ascending: false }).limit(1)
  if (lastSub?.[0]) {
    const { data: fb } = await supabase.from('review_feedback').select('next_action').eq('submission_id', lastSub[0].id).eq('status', 'published').maybeSingle()
    if (fb?.next_action) latestNextAction = fb.next_action
  }
  const systemPrompt = buildCoachSystemPrompt({
    courseName: (task.course as unknown as { title: string } | null)?.title || '',
    assignmentTitle: task.title, skillLevels, latestNextAction,
  })

  // 丸投げの兆候は会話にフラグ（ブロックはしない）
  if (detectDumpRequest(message)) {
    await supabase.from('coach_conversations').update({ flagged: true }).eq('id', conversationId)
  }

  // ユーザー発言を保存
  await supabase.from('coach_messages').insert({ conversation_id: conversationId, role: 'user', content: message })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    const fallback = '（AIコーチは現在準備中です。設定が整うまでは、詰まっている点を講師に相談してください。）'
    await supabase.from('coach_messages').insert({ conversation_id: conversationId, role: 'assistant', content: fallback })
    return NextResponse.json({ reply: fallback, configured: false })
  }

  // 直近の履歴
  const { data: hist } = await supabase.from('coach_messages').select('role, content').eq('conversation_id', conversationId).order('created_at', { ascending: true }).limit(20)
  const messages = (hist || []).map((m) => ({ role: m.role, content: m.content }))

  let reply = ''
  let tokensIn: number | null = null
  let tokensOut: number | null = null
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system: systemPrompt, messages }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data?.error?.message || 'AIコーチの呼び出しに失敗しました' }, { status: 502 })
    reply = (data?.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('\n').trim()
    tokensIn = data?.usage?.input_tokens ?? null
    tokensOut = data?.usage?.output_tokens ?? null
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }

  await supabase.from('coach_messages').insert({ conversation_id: conversationId, role: 'assistant', content: reply || '（応答がありませんでした）', tokens_in: tokensIn, tokens_out: tokensOut })
  return NextResponse.json({ reply, remaining: settings.aiCoachDailyLimit - usedToday - 1 })
}
