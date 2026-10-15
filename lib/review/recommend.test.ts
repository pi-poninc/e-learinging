import { describe, it, expect } from 'vitest'
import { recommendTasks, RecoTask, RecoContext } from './recommend'

const task = (id: string, p: Partial<RecoTask> = {}): RecoTask => ({
  id, assignment_type: 'drill', difficulty_level: null, target_skill_ids: [], prerequisite_grade_id: null, ...p,
})

describe('recommendTasks', () => {
  it('弱いスキルの課題を上位にする', () => {
    const ctx: RecoContext = {
      userSkillLevels: { weak: { level: 1, confidence: 'medium' }, strong: { level: 4, confidence: 'high' } },
      approvedGradeLevel: 0, gradeLevelById: {},
    }
    const r = recommendTasks([
      task('strong', { target_skill_ids: ['strong'], difficulty_level: 5 }),
      task('weak', { target_skill_ids: ['weak'], difficulty_level: 2 }),
    ], ctx)
    expect(r[0].task.id).toBe('weak')
  })

  it('難易度は現在レベル＋1を＋3より優先する', () => {
    const ctx: RecoContext = {
      userSkillLevels: { s: { level: 2, confidence: 'medium' } },
      approvedGradeLevel: 0, gradeLevelById: {},
    }
    const r = recommendTasks([
      task('tooHard', { target_skill_ids: ['s'], difficulty_level: 5 }), // gap 3
      task('ideal', { target_skill_ids: ['s'], difficulty_level: 3 }),   // gap 1
    ], ctx)
    expect(r[0].task.id).toBe('ideal')
  })

  it('前提グレードが現在の承認グレードより上ならロック', () => {
    const ctx: RecoContext = {
      userSkillLevels: {}, approvedGradeLevel: 2,
      gradeLevelById: { g4: 4, g2: 2 },
    }
    const r = recommendTasks([
      task('locked', { prerequisite_grade_id: 'g4' }),   // 4 > 2 → ロック
      task('open', { prerequisite_grade_id: 'g2' }),     // 2 <= 2 → 解放
    ], ctx)
    const locked = r.find((x) => x.task.id === 'locked')!
    const open = r.find((x) => x.task.id === 'open')!
    expect(locked.locked).toBe(true)
    expect(open.locked).toBe(false)
    // ロックは後ろ
    expect(r[r.length - 1].task.id).toBe('locked')
  })

  it('対象スキルが無い課題は弱点0扱い（基礎向けで上位になりやすい）', () => {
    const ctx: RecoContext = { userSkillLevels: {}, approvedGradeLevel: 0, gradeLevelById: {} }
    const r = recommendTasks([task('drill', { difficulty_level: 1 })], ctx)
    expect(r[0].weakestLevel).toBe(0)
    expect(r[0].locked).toBe(false)
  })
})
