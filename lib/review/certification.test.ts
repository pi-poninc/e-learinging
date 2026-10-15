import { describe, it, expect } from 'vitest'
import { certificationEligible, genCertificateNumber, CertContext } from './certification'

const ctx = (over: Partial<CertContext> = {}): CertContext => ({
  approvedGradeLevel: 0, reviewedTaskIds: new Set(), hasDemoDay: false, ...over,
})

describe('certificationEligible', () => {
  it('要件が空なら不合格（自動では出さない）', () => {
    expect(certificationEligible(ctx({ approvedGradeLevel: 6 }), {})).toBe(false)
  })
  it('グレード要件を満たす/満たさない', () => {
    expect(certificationEligible(ctx({ approvedGradeLevel: 6 }), { grade_level: 6 })).toBe(true)
    expect(certificationEligible(ctx({ approvedGradeLevel: 5 }), { grade_level: 6 })).toBe(false)
  })
  it('必須課題をすべて添削済みであること', () => {
    const c = ctx({ approvedGradeLevel: 6, reviewedTaskIds: new Set(['t1']) })
    expect(certificationEligible(c, { grade_level: 6, required_task_ids: ['t1'] })).toBe(true)
    expect(certificationEligible(c, { grade_level: 6, required_task_ids: ['t1', 't2'] })).toBe(false)
  })
  it('デモデイ参加が必要', () => {
    expect(certificationEligible(ctx({ approvedGradeLevel: 6, hasDemoDay: false }), { grade_level: 6, demo_day: true })).toBe(false)
    expect(certificationEligible(ctx({ approvedGradeLevel: 6, hasDemoDay: true }), { grade_level: 6, demo_day: true })).toBe(true)
  })
})

describe('genCertificateNumber', () => {
  it('PIPON-年-ランダム の形式', () => {
    expect(genCertificateNumber(new Date('2026-05-01T00:00:00Z'))).toMatch(/^PIPON-2026-[A-Z0-9]{6}$/)
  })
})
