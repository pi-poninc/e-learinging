import { describe, it, expect } from 'vitest'
import { buildDraftUserContent, rewriteRate, levenshtein } from './ai-draft'

describe('buildDraftUserContent', () => {
  it('課題・ルーブリック・提出・良い例を含む', () => {
    const out = buildDraftUserContent({
      assignmentTitle: 'ケースA', instructions: '整理して提案',
      submissionText: '私の提案は...', rubricItems: [{ id: 'r1', label: '顧客課題の言語化' }],
      exemplars: ['良かった点: 構造化できている'],
    })
    expect(out).toContain('ケースA')
    expect(out).toContain('顧客課題の言語化 (id: r1)')
    expect(out).toContain('私の提案は...')
    expect(out).toContain('良い添削の例')
  })
})

describe('rewriteRate', () => {
  it('無変更は0', () => { expect(rewriteRate('同じ文です', '同じ文です')).toBe(0) })
  it('全書き換えは1に近い', () => { expect(rewriteRate('aaaa', 'bbbb')).toBe(1) })
  it('一部変更は0と1の間', () => {
    const r = rewriteRate('こんにちは世界', 'こんにちは地球')
    expect(r).toBeGreaterThan(0); expect(r).toBeLessThan(1)
  })
})

describe('levenshtein', () => {
  it('基本', () => { expect(levenshtein('kitten', 'sitting')).toBe(3) })
})
