import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { peerReviewEnabled, skillMapEnabled } from '@/lib/flags'
import { getReviewSettings, STAFF_ROLES } from '@/lib/review/service'
import { computeSkillLevel } from '@/lib/review/skill-levels'

// 承認済みグレードの最高段階（コース単位）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function approvedGradeLevel(db: any, userId: string, courseId: string): Promise<number> {
  const { data: ug } = await db.from('user_grades').select('grade_id').eq('user_id', userId).eq('status', 'approved')
  const ids = (ug || []).map((g: { grade_id: string }) => g.grade_id)
  if (!ids.length) return 0
  const { data: gr } = await db.from('grades').select('level').in('id', ids).eq('course_id', courseId)
  return Math.max(0, ...(gr || []).map((g: { level: number }) => g.level))
}

export async function POST(request: NextRequest) {
  if (!peerReviewEnabled()) return NextResponse.json({ error: '機能が無効です' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action } = body

  // 受講者が「参考になった」
  if (action === 'react') {
    const { error } = await supabase.from('peer_reviews').update({ reviewee_reaction: true }).eq('id', body.peerReviewId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // 講師が「役に立った度」を評価 → レビュアーの「説明・提案」スキルへ反映
  if (action === 'rate') {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (!profile || !STAFF_ROLES.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { peerReviewId, helpfulness, comment } = body
    if (!peerReviewId || !(helpfulness >= 1 && helpfulness <= 3)) {
      return NextResponse.json({ error: 'helpfulness(1-3) が必要です' }, { status: 400 })
    }
    const { data: pr } = await supabase.from('peer_reviews').select('id, reviewer_id, submission_id').eq('id', peerReviewId).maybeSingle()
    if (!pr) return NextResponse.json({ error: '対象が見つかりません' }, { status: 404 })
    await supabase.from('peer_reviews').update({ helpfulness, helpfulness_comment: comment || null }).eq('id', peerReviewId)

    // スキル反映（best-effort）: 対象提出のコースの「説明・提案」スキル
    if (skillMapEnabled()) {
      try {
        const { data: sub } = await supabase.from('review_submissions').select('course_id').eq('id', pr.submission_id).maybeSingle()
        if (sub) {
          const { data: skill } = await supabase
            .from('skills').select('id, skill_map:skill_maps!inner(course_id)')
            .eq('name', '説明・提案').eq('skill_map.course_id', sub.course_id).limit(1).maybeSingle()
          if (skill) {
            const level = Math.min(5, Math.max(1, helpfulness + 1)) // 1-3 → 2-4
            await supabase.from('skill_assessments').insert({
              user_id: pr.reviewer_id, skill_id: skill.id, source_type: 'peer_review',
              source_id: peerReviewId, level_observed: level, assessed_by: user.id,
            })
            const { data: all } = await supabase
              .from('skill_assessments').select('level_observed, source_type, assessed_at')
              .eq('user_id', pr.reviewer_id).eq('skill_id', skill.id).order('assessed_at', { ascending: false }).limit(20)
            const result = computeSkillLevel(all || [])
            if (result.level !== null) {
              await supabase.from('user_skill_levels').upsert({
                user_id: pr.reviewer_id, skill_id: skill.id, current_level: result.level,
                confidence: result.confidence, updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id,skill_id' })
            }
          }
        }
      } catch { /* スキル反映失敗は評価自体を止めない */ }
    }
    return NextResponse.json({ ok: true })
  }

  // ピアレビューを1件引き受ける（ルールに沿って割り当てる）
  if (action === 'claim') {
    const svc = await createServiceClient()
    // 自分が提出済みの課題
    const { data: mySubs } = await supabase.from('review_submissions').select('task_id').eq('user_id', user.id).neq('status', 'draft')
    const myTaskIds = Array.from(new Set((mySubs || []).map((s) => s.task_id)))
    if (!myTaskIds.length) return NextResponse.json({ error: 'まず自分が課題を提出してください' }, { status: 400 })

    // 候補: 同じ課題・他人・下書きでない提出（他人分の走査はサービスロールで、ルールはサーバーで強制）
    const { data: cands } = await svc.from('review_submissions')
      .select('id, user_id, course_id, task_id').in('task_id', myTaskIds).neq('user_id', user.id).neq('status', 'draft')
      .order('submitted_at', { ascending: true }).limit(50)

    // 既にレビュー済み/割当済みの提出は除外
    const { data: mine } = await supabase.from('peer_reviews').select('submission_id').eq('reviewer_id', user.id)
    const taken = new Set((mine || []).map((m) => m.submission_id))

    const myGradeByCourse = new Map<string, number>()
    for (const c of cands || []) {
      if (taken.has(c.id)) continue
      // 定員2件
      const { count } = await svc.from('peer_reviews').select('id', { count: 'exact', head: true }).eq('submission_id', c.id)
      if ((count || 0) >= 2) continue
      // グレード条件
      let myGrade = myGradeByCourse.get(c.course_id)
      if (myGrade === undefined) { myGrade = await approvedGradeLevel(svc, user.id, c.course_id); myGradeByCourse.set(c.course_id, myGrade) }
      const settings = await getReviewSettings(svc, c.course_id)
      if (myGrade < settings.peerReviewMinGrade) continue
      const theirGrade = await approvedGradeLevel(svc, c.user_id, c.course_id)
      if (theirGrade > myGrade) continue
      // 割り当て
      const { error } = await supabase.from('peer_reviews').insert({ submission_id: c.id, reviewer_id: user.id, status: 'assigned' })
      if (!error) return NextResponse.json({ assigned: c.id })
    }
    return NextResponse.json({ none: true })
  }

  // 割り当てられたピアレビューを書いて提出
  if (action === 'submit') {
    const { peerReviewId, goodPoints, comment } = body
    if (!peerReviewId || (!goodPoints && !comment)) {
      return NextResponse.json({ error: 'コメントを入力してください' }, { status: 400 })
    }
    const { data: pr } = await supabase.from('peer_reviews').select('id, reviewer_id, status').eq('id', peerReviewId).maybeSingle()
    if (!pr || pr.reviewer_id !== user.id) return NextResponse.json({ error: '対象が見つかりません' }, { status: 404 })
    if (pr.status !== 'assigned') return NextResponse.json({ error: 'すでに提出済みです' }, { status: 409 })
    const { error } = await supabase.from('peer_reviews')
      .update({ status: 'submitted', good_points: goodPoints || null, comment: comment || null }).eq('id', peerReviewId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: '不明なaction' }, { status: 400 })
}
