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

  // 公開前の自分の担当を解放（他の添削者に回せるようにする）
  await supabase
    .from('review_feedback')
    .delete()
    .eq('submission_id', submissionId)
    .eq('reviewer_id', user.id)
    .neq('status', 'published')
  await supabase
    .from('review_submissions')
    .update({ status: 'submitted' })
    .eq('id', submissionId)
    .eq('status', 'in_review')

  return NextResponse.json({ ok: true })
}
