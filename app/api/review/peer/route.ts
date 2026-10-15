import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { peerReviewEnabled } from '@/lib/flags'
import { getReviewSettings, STAFF_ROLES } from '@/lib/review/service'

// 承認済みグレードの最高段階（コース単位）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function approvedGradeLevel(supabase: any, userId: string, courseId: string): Promise<number> {
  const { data: ug } = await supabase.from('user_grades').select('grade_id').eq('user_id', userId).eq('status', 'approved')
  const ids = (ug || []).map((g: { grade_id: string }) => g.grade_id)
  if (!ids.length) return 0
  const { data: gr } = await supabase.from('grades').select('level').in('id', ids).eq('course_id', courseId)
  return Math.max(0, ...(gr || []).map((g: { level: number }) => g.level))
}

export async function POST(request: NextRequest) {
  if (!peerReviewEnabled()) return NextResponse.json({ error: '機能が無効です' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action } = body

  // 受講者が自分の提出に付いたピアレビューへ「参考になった」
  if (action === 'react') {
    const { peerReviewId } = body
    const { error } = await supabase.from('peer_reviews').update({ reviewee_reaction: true }).eq('id', peerReviewId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // 講師がピアレビューの「役に立った度」を評価
  if (action === 'rate') {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (!profile || !STAFF_ROLES.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { peerReviewId, helpfulness, comment } = body
    if (!peerReviewId || !(helpfulness >= 1 && helpfulness <= 3)) {
      return NextResponse.json({ error: 'helpfulness(1-3) が必要です' }, { status: 400 })
    }
    const { error } = await supabase.from('peer_reviews').update({ helpfulness, helpfulness_comment: comment || null }).eq('id', peerReviewId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ピアレビューを書く（自己クレーム＋提出）
  if (action === 'submit') {
    const { submissionId, goodPoints, comment } = body
    if (!submissionId || (!goodPoints && !comment)) {
      return NextResponse.json({ error: '提出先とコメントが必要です' }, { status: 400 })
    }
    const { data: sub } = await supabase
      .from('review_submissions').select('id, user_id, task_id, course_id').eq('id', submissionId).maybeSingle()
    if (!sub) return NextResponse.json({ error: '提出が見つかりません' }, { status: 404 })
    if (sub.user_id === user.id) return NextResponse.json({ error: '自分の提出はピアレビューできません' }, { status: 400 })

    // 同じ課題を自分が提出済みであること
    const { count: mySubs } = await supabase
      .from('review_submissions').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('task_id', sub.task_id).neq('status', 'draft')
    if (!mySubs) return NextResponse.json({ error: '同じ課題を自分が提出していないとピアレビューできません' }, { status: 403 })

    // グレード条件：自分が開始グレード以上／相手は自分と同等以下
    const settings = await getReviewSettings(supabase, sub.course_id)
    const myGrade = await approvedGradeLevel(supabase, user.id, sub.course_id)
    if (myGrade < settings.peerReviewMinGrade) {
      return NextResponse.json({ error: `ピアレビューはグレード${settings.peerReviewMinGrade}以上で解放されます` }, { status: 403 })
    }
    const theirGrade = await approvedGradeLevel(supabase, sub.user_id, sub.course_id)
    if (theirGrade > myGrade) {
      return NextResponse.json({ error: '自分より上のグレードの提出はピアレビューできません' }, { status: 403 })
    }

    // 1提出につきピアレビューは最大2件
    const { count: existing } = await supabase
      .from('peer_reviews').select('id', { count: 'exact', head: true }).eq('submission_id', submissionId)
    if ((existing || 0) >= 2) return NextResponse.json({ error: 'この提出のピアレビューは定員（2件）に達しています' }, { status: 409 })

    const { data, error } = await supabase
      .from('peer_reviews').insert({ submission_id: submissionId, reviewer_id: user.id, good_points: goodPoints || null, comment: comment || null })
      .select('id').single()
    if (error) {
      if ((error as { code?: string }).code === '23505') return NextResponse.json({ error: 'すでにこの提出をピアレビュー済みです' }, { status: 409 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ id: data.id })
  }

  return NextResponse.json({ error: '不明なaction' }, { status: 400 })
}
