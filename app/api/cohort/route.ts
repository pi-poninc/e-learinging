import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cohortEnabled } from '@/lib/flags'

export async function POST(request: NextRequest) {
  if (!cohortEnabled()) return NextResponse.json({ error: '機能が無効です' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action } = body

  // 自分のタイムライン共有の切り替え
  if (action === 'toggle_share') {
    const { cohortId, share } = body
    const { error } = await supabase.from('cohort_members').update({ share_activity: !!share }).eq('cohort_id', cohortId).eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // 応援（同じ期の仲間の提出にだけ）
  if (action === 'cheer') {
    const { submissionId } = body
    if (!submissionId) return NextResponse.json({ error: 'submissionId が必要です' }, { status: 400 })
    const svc = await createServiceClient()
    const { data: sub } = await svc.from('review_submissions').select('user_id').eq('id', submissionId).maybeSingle()
    if (!sub) return NextResponse.json({ error: '提出が見つかりません' }, { status: 404 })
    if (sub.user_id === user.id) return NextResponse.json({ error: '自分の提出は応援できません' }, { status: 400 })
    // 同じ期に所属しているか
    const { data: mine } = await svc.from('cohort_members').select('cohort_id').eq('user_id', user.id)
    const myCohorts = new Set((mine || []).map((m: { cohort_id: string }) => m.cohort_id))
    const { data: theirs } = await svc.from('cohort_members').select('cohort_id').eq('user_id', sub.user_id)
    const shareCohort = (theirs || []).some((m: { cohort_id: string }) => myCohorts.has(m.cohort_id))
    if (!shareCohort) return NextResponse.json({ error: '同じ期の仲間だけ応援できます' }, { status: 403 })

    const { error } = await supabase.from('submission_cheers').insert({ submission_id: submissionId, user_id: user.id })
    if (error && (error as { code?: string }).code !== '23505') return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: '不明なaction' }, { status: 400 })
}
