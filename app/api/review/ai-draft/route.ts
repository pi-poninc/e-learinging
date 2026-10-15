import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { submissionReviewEnabled } from '@/lib/flags'
import { STAFF_ROLES, getReviewSettings } from '@/lib/review/service'
import { DRAFT_SYSTEM_PROMPT, buildDraftUserContent } from '@/lib/review/ai-draft'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5'

export async function POST(request: NextRequest) {
  if (!submissionReviewEnabled()) return NextResponse.json({ error: '機能が無効です' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF_ROLES.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { submissionId, action } = body
  if (!submissionId) return NextResponse.json({ error: 'submissionId が必要です' }, { status: 400 })

  // 良い添削として登録/解除
  if (action === 'mark_exemplar') {
    const { error } = await supabase.from('review_feedback').update({ is_exemplar: !!body.value }).eq('submission_id', submissionId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // 下書き生成
  const { data: sub } = await supabase.from('review_submissions').select('course_id, task_id, content_text, content_url').eq('id', submissionId).maybeSingle()
  if (!sub) return NextResponse.json({ error: '提出が見つかりません' }, { status: 404 })
  const settings = await getReviewSettings(supabase, sub.course_id)
  if (!settings.aiDraftEnabled) {
    return NextResponse.json({ error: 'このコースではAI下書きは無効です' }, { status: 403 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI下書きは現在利用できません（APIキー未設定）' }, { status: 503 })

  const { data: task } = await supabase.from('review_tasks').select('title, instructions, rubric_id').eq('id', sub.task_id).maybeSingle()
  let rubricItems: { id: string; label: string }[] = []
  if (task?.rubric_id) {
    const { data: items } = await supabase.from('rubric_items').select('id, label').eq('rubric_id', task.rubric_id).order('order_index')
    rubricItems = (items || []).map((i) => ({ id: i.id, label: i.label }))
  }
  // 良い添削の例（このコース・最大3件）
  const { data: ex } = await supabase.from('review_feedback')
    .select('good_points, improvements, next_action, submission:review_submissions(course_id)').eq('is_exemplar', true).limit(10)
  const exemplars = (ex || [])
    .filter((e) => (e.submission as unknown as { course_id: string } | null)?.course_id === sub.course_id)
    .slice(0, 3)
    .map((e) => `良かった点: ${e.good_points || ''}\n改善点: ${e.improvements || ''}\n次にやること: ${e.next_action || ''}`)

  const userContent = buildDraftUserContent({
    assignmentTitle: task?.title || '', instructions: task?.instructions || '',
    submissionText: sub.content_text || sub.content_url || '', rubricItems, exemplars,
  })

  let draft: { good_points?: string; improvements?: string; next_action?: string; rubric_scores?: Record<string, number> } | null = null
  for (let attempt = 0; attempt < 2 && !draft; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: MODEL, max_tokens: 900, system: DRAFT_SYSTEM_PROMPT, messages: [{ role: 'user', content: userContent }] }),
      })
      const data = await res.json()
      if (!res.ok) return NextResponse.json({ error: data?.error?.message || 'AI呼び出しに失敗しました' }, { status: 502 })
      const text = (data?.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('')
      const json = text.replace(/```json|```/g, '').trim()
      draft = JSON.parse(json)
    } catch { draft = null }
  }
  if (!draft) return NextResponse.json({ error: 'AIの出力を解釈できませんでした。もう一度お試しください。' }, { status: 502 })

  // ai_draft を保存（学習者には出さない）
  await supabase.from('review_feedback').update({ ai_draft: draft }).eq('submission_id', submissionId)
  return NextResponse.json({ draft })
}
