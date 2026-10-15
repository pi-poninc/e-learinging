import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cohortEnabled } from '@/lib/flags'
import { STAFF_ROLES } from '@/lib/review/service'
import { computeSkillLevel } from '@/lib/review/skill-levels'
import { randomBytes } from 'crypto'

export async function POST(request: NextRequest) {
  if (!cohortEnabled()) return NextResponse.json({ error: '機能が無効です' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action } = body

  // 発表の登録・更新（本人）
  if (action === 'entry') {
    const { cohortId, title, description, videoUrl, demoUrl } = body
    if (!cohortId || !title?.trim()) return NextResponse.json({ error: 'cohortId と title が必要です' }, { status: 400 })
    const { error } = await supabase.from('demo_day_entries').upsert({
      cohort_id: cohortId, user_id: user.id, title: title.trim(),
      description: description || null, video_url: videoUrl || null, demo_url: demoUrl || null,
    }, { onConflict: 'cohort_id,user_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // 以降はスタッフのみ
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF_ROLES.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // 講師評価 → スキルへ反映（source_type demo_day）
  if (action === 'evaluate') {
    const { entryId, scores, comment } = body
    if (!entryId) return NextResponse.json({ error: 'entryId が必要です' }, { status: 400 })
    const { data: entry } = await supabase.from('demo_day_entries').select('user_id').eq('id', entryId).maybeSingle()
    if (!entry) return NextResponse.json({ error: '発表が見つかりません' }, { status: 404 })

    await supabase.from('demo_day_evaluations').insert({
      entry_id: entryId, evaluator_id: user.id, evaluator_type: 'instructor', scores: scores || {}, comment: comment || null,
    })

    // スキル反映
    const entries = Object.entries((scores || {}) as Record<string, number>)
    for (const [skillId, level] of entries) {
      if (!level) continue
      await supabase.from('skill_assessments').insert({
        user_id: entry.user_id, skill_id: skillId, source_type: 'demo_day', source_id: entryId, level_observed: level, assessed_by: user.id,
      })
      const { data: all } = await supabase.from('skill_assessments')
        .select('level_observed, source_type, assessed_at').eq('user_id', entry.user_id).eq('skill_id', skillId).order('assessed_at', { ascending: false }).limit(20)
      const r = computeSkillLevel(all || [])
      if (r.level !== null) {
        await supabase.from('user_skill_levels').upsert({
          user_id: entry.user_id, skill_id: skillId, current_level: r.level, confidence: r.confidence, updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,skill_id' })
      }
    }
    return NextResponse.json({ ok: true })
  }

  // ゲスト評価者の期限付きURL発行
  if (action === 'guest_token') {
    const { cohortId, label, expiresInDays } = body
    if (!cohortId) return NextResponse.json({ error: 'cohortId が必要です' }, { status: 400 })
    const token = randomBytes(18).toString('base64url')
    const expires = new Date(Date.now() + (expiresInDays || 14) * 24 * 3600 * 1000).toISOString()
    const { error } = await supabase.from('demo_day_guest_tokens').insert({ cohort_id: cohortId, token, label: label || null, expires_at: expires, created_by: user.id })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ token, expiresAt: expires })
  }

  return NextResponse.json({ error: '不明なaction' }, { status: 400 })
}
