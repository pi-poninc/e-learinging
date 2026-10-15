import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { submissionReviewEnabled } from '@/lib/flags'
import { STAFF_ROLES } from '@/lib/review/service'

export async function POST(request: NextRequest) {
  if (!submissionReviewEnabled()) return NextResponse.json({ error: '機能が無効です' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { submissionId } = await request.json()
  if (!submissionId) return NextResponse.json({ error: 'submissionId が必要です' }, { status: 400 })

  // 同時確保の上限
  const { data: rp } = await supabase.from('reviewer_profiles').select('max_concurrent_claims').eq('user_id', user.id).maybeSingle()
  const maxc = rp?.max_concurrent_claims ?? 3
  const { count } = await supabase
    .from('review_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('reviewer_id', user.id)
    .in('status', ['claimed', 'drafting'])
  if ((count || 0) >= maxc) {
    return NextResponse.json({ error: `同時に担当できる上限（${maxc}件）に達しています` }, { status: 409 })
  }

  // submission_id は unique。2人が同時に押しても1人しか成功しない。
  const { data, error } = await supabase
    .from('review_feedback')
    .insert({ submission_id: submissionId, reviewer_id: user.id, status: 'claimed' })
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: '他の添削者が担当中です' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase.from('review_submissions').update({ status: 'in_review' }).eq('id', submissionId)
  return NextResponse.json({ feedback: data })
}
