import { describe, it, expect } from 'vitest'
import { computeSkillLevel, gradeEligible, AssessmentInput } from './skill-levels'

const a = (level: number, date: string, source: AssessmentInput['source_type'] = 'review'): AssessmentInput =>
  ({ level_observed: level, source_type: source, assessed_at: date })

describe('computeSkillLevel', () => {
  it('評価なしは level=null / low / 0件', () => {
    expect(computeSkillLevel([])).toEqual({ level: null, confidence: 'low', count: 0 })
  })
  it('2件は low（根拠不足＝判定に使わない）', () => {
    const r = computeSkillLevel([a(3, '2026-03-01'), a(4, '2026-03-02')])
    expect(r.confidence).toBe('low')
    expect(r.count).toBe(2)
  })
  it('3件で medium、平均が出る', () => {
    const r = computeSkillLevel([a(3, '2026-03-01'), a(4, '2026-03-02'), a(5, '2026-03-03')])
    expect(r.confidence).toBe('medium')
    expect(r.level).toBe(4)
  })
  it('5件以上で high、直近N=5だけ使う', () => {
    const r = computeSkillLevel([
      a(1, '2026-01-01'), // 古い→除外されるはず
      a(5, '2026-03-01'), a(5, '2026-03-02'), a(5, '2026-03-03'), a(5, '2026-03-04'), a(5, '2026-03-05'),
    ])
    expect(r.confidence).toBe('high')
    expect(r.level).toBe(5) // 古い1は除外、直近5件はすべて5
    expect(r.count).toBe(5)
  })
  it('peer_review は重みが下がる（0.5）', () => {
    // review:4 (w1), peer:2 (w0.5) → (4*1 + 2*0.5)/(1.5) = 5/1.5 = 3.33
    const r = computeSkillLevel([a(4, '2026-03-02', 'review'), a(2, '2026-03-01', 'peer_review')])
    expect(r.level).toBe(3.3)
  })
})

describe('gradeEligible', () => {
  const lv = (level: number, confidence: 'low' | 'medium' | 'high') => ({ level, confidence })
  it('全スキルが必要レベル以上かつ low でない → 合格', () => {
    const levels = { s1: lv(3, 'high'), s2: lv(4, 'medium') }
    expect(gradeEligible(levels, { s1: 3, s2: 4 })).toBe(true)
  })
  it('1つでも未達 → 不合格', () => {
    const levels = { s1: lv(2, 'high'), s2: lv(4, 'high') }
    expect(gradeEligible(levels, { s1: 3, s2: 4 })).toBe(false)
  })
  it('low のスキルは未達扱い', () => {
    const levels = { s1: lv(5, 'low') }
    expect(gradeEligible(levels, { s1: 3 })).toBe(false)
  })
  it('評価が無いスキルが要件にある → 不合格', () => {
    expect(gradeEligible({ s1: lv(5, 'high') }, { s1: 3, s2: 2 })).toBe(false)
  })
  it('要件が空 → 不合格（自動では上げない）', () => {
    expect(gradeEligible({ s1: lv(5, 'high') }, {})).toBe(false)
  })
})
