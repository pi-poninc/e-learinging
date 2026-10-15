/**
 * スキルレベルの算出とグレード判定（純関数）。skill_assessments から常に再計算できる。
 * 重み・件数は settings で変えられる。原則: ピアレビューは重みを下げる／根拠3件未満は low（判定に使わない）。
 */

export interface AssessmentInput {
  level_observed: number
  source_type: 'review' | 'peer_review' | 'case_assignment' | 'demo_day' | 'manual'
  assessed_at: string
}

export interface SkillLevelResult {
  level: number | null
  confidence: 'low' | 'medium' | 'high'
  count: number
}

export interface SkillLevelOptions {
  recentN?: number       // 直近何件を使うか（既定5）
  peerWeight?: number    // peer_review の重み（既定0.5）
  lowBelow?: number      // この件数未満なら low（既定3）
  highAtOrAbove?: number // この件数以上なら high（既定5）
}

export function computeSkillLevel(assessments: AssessmentInput[], opts: SkillLevelOptions = {}): SkillLevelResult {
  const recentN = opts.recentN ?? 5
  const peerWeight = opts.peerWeight ?? 0.5
  const lowBelow = opts.lowBelow ?? 3
  const highAtOrAbove = opts.highAtOrAbove ?? 5

  const sorted = [...assessments].sort((a, b) => b.assessed_at.localeCompare(a.assessed_at))
  const recent = sorted.slice(0, recentN)
  if (recent.length === 0) return { level: null, confidence: 'low', count: 0 }

  let wsum = 0
  let vsum = 0
  for (const a of recent) {
    const w = a.source_type === 'peer_review' ? peerWeight : 1
    wsum += w
    vsum += w * a.level_observed
  }
  const level = wsum === 0 ? null : Math.round((vsum / wsum) * 10) / 10

  const count = recent.length
  const confidence: SkillLevelResult['confidence'] =
    count < lowBelow ? 'low' : count >= highAtOrAbove ? 'high' : 'medium'

  return { level, confidence, count }
}

/**
 * グレード条件を満たすか。requirements は { skill_id: 必要レベル }。
 * 根拠が low のスキルは「未達」扱い（確からしさが足りないものでグレードを上げない）。
 */
export function gradeEligible(
  levels: Record<string, { level: number | null; confidence: 'low' | 'medium' | 'high' }>,
  requirements: Record<string, number>,
): boolean {
  const entries = Object.entries(requirements || {})
  if (entries.length === 0) return false
  for (const [skillId, min] of entries) {
    const l = levels[skillId]
    if (!l || l.level === null || l.confidence === 'low' || l.level < min) return false
  }
  return true
}
