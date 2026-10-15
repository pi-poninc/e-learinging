import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cohortEnabled } from '@/lib/flags'

// ゲスト評価者（ログイン不要）。トークンの有効期限を検証して評価を受け付ける。
export async function POST(request: NextRequest) {
  if (!cohortEnabled()) return NextResponse.json({ error: '機能が無効です' }, { status: 404 })

  const { token, entryId, scores, comment } = await request.json()
  if (!token || !entryId) return NextResponse.json({ error: 'token と entryId が必要です' }, { status: 400 })

  const svc = await createServiceClient()
  const { data: tok } = await svc.from('demo_day_guest_tokens').select('cohort_id, expires_at').eq('token', token).maybeSingle()
  if (!tok) return NextResponse.json({ error: '無効なURLです' }, { status: 403 })
  if (new Date(tok.expires_at).getTime() < Date.now()) return NextResponse.json({ error: 'このURLは期限切れです' }, { status: 403 })

  // 対象の発表が、このトークンの期のものか
  const { data: entry } = await svc.from('demo_day_entries').select('id, cohort_id').eq('id', entryId).maybeSingle()
  if (!entry || entry.cohort_id !== tok.cohort_id) return NextResponse.json({ error: '対象の発表が見つかりません' }, { status: 404 })

  const { error } = await svc.from('demo_day_evaluations').insert({
    entry_id: entryId, evaluator_id: null, evaluator_type: 'guest', scores: scores || {}, comment: comment || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
