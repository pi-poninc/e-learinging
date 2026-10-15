/**
 * 添削公開時：ルーブリック評価 → skill_assessments を作り、現在レベルを再計算し、
 * グレードの eligible 判定とイベント記録を行う（原則G6: 自動で承認はしない）。
 * スタッフ（添削者）の権限で呼ばれる前提。失敗しても公開自体は止めない呼び出し側で握る。
 */
import { computeSkillLevel, gradeEligible } from './skill-levels'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any

export async function applyReviewSkillAssessments(
  supabase: DB,
  args: { submissionId: string; reviewerId: string; rubricScores?: Record<string, number> },
): Promise<{ assessedSkillIds: string[] }> {
  const { submissionId, reviewerId } = args

  const { data: sub } = await supabase
    .from('review_submissions')
    .select('user_id, task_id, course_id')
    .eq('id', submissionId)
    .maybeSingle()
  if (!sub) return { assessedSkillIds: [] }

  const { data: task } = await supabase
    .from('review_tasks')
    .select('rubric_id')
    .eq('id', sub.task_id)
    .maybeSingle()
  if (!task?.rubric_id) return { assessedSkillIds: [] }

  // rubric_scores は { rubric_item_id: level }。本文 or feedback から渡される。
  let scores = args.rubricScores
  if (!scores) {
    const { data: fb } = await supabase.from('review_feedback').select('rubric_scores').eq('submission_id', submissionId).maybeSingle()
    scores = (fb?.rubric_scores as Record<string, number>) || {}
  }
  if (!scores || Object.keys(scores).length === 0) return { assessedSkillIds: [] }

  const { data: items } = await supabase
    .from('rubric_items')
    .select('id, skill_id')
    .eq('rubric_id', task.rubric_id)
  const skillByItem = new Map<string, string | null>()
  for (const it of items || []) skillByItem.set(it.id, it.skill_id)

  // 1) スキル評価を記録
  const assessedSkillIds = new Set<string>()
  const rows: Record<string, unknown>[] = []
  for (const [itemId, level] of Object.entries(scores)) {
    const skillId = skillByItem.get(itemId)
    if (!skillId) continue
    assessedSkillIds.add(skillId)
    rows.push({
      user_id: sub.user_id,
      skill_id: skillId,
      source_type: 'review',
      source_id: submissionId,
      level_observed: level,
      assessed_by: reviewerId,
    })
  }
  if (rows.length === 0) return { assessedSkillIds: [] }
  await supabase.from('skill_assessments').insert(rows)

  // 2) 影響スキルの現在レベルを再計算して upsert
  for (const skillId of assessedSkillIds) {
    const { data: all } = await supabase
      .from('skill_assessments')
      .select('level_observed, source_type, assessed_at')
      .eq('user_id', sub.user_id)
      .eq('skill_id', skillId)
      .order('assessed_at', { ascending: false })
      .limit(20)
    const result = computeSkillLevel(all || [])
    if (result.level !== null) {
      await supabase.from('user_skill_levels').upsert({
        user_id: sub.user_id,
        skill_id: skillId,
        current_level: result.level,
        confidence: result.confidence,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,skill_id' })
    }
  }

  // 3) グレードの eligible 判定（自動承認はしない）
  const { data: levels } = await supabase
    .from('user_skill_levels')
    .select('skill_id, current_level, confidence')
    .eq('user_id', sub.user_id)
  const levelMap: Record<string, { level: number; confidence: 'low' | 'medium' | 'high' }> = {}
  for (const l of levels || []) levelMap[l.skill_id] = { level: l.current_level, confidence: l.confidence }

  const { data: grades } = await supabase.from('grades').select('id, requirements').eq('course_id', sub.course_id)
  for (const g of grades || []) {
    if (gradeEligible(levelMap, (g.requirements as Record<string, number>) || {})) {
      const { data: existing } = await supabase.from('user_grades').select('id').eq('user_id', sub.user_id).eq('grade_id', g.id).maybeSingle()
      if (!existing) {
        await supabase.from('user_grades').insert({
          user_id: sub.user_id,
          grade_id: g.id,
          status: 'eligible',
          evidence: { skill_levels: levelMap, triggered_by: submissionId },
        })
        await supabase.from('learning_events').insert({
          user_id: sub.user_id, course_id: sub.course_id, event_name: 'grade_eligible',
          properties: { grade_id: g.id },
        })
      }
    }
  }

  // 4) イベント記録
  await supabase.from('learning_events').insert({
    user_id: sub.user_id, course_id: sub.course_id, event_name: 'skills_assessed',
    properties: { submission_id: submissionId, skill_ids: [...assessedSkillIds] },
  })

  return { assessedSkillIds: [...assessedSkillIds] }
}
