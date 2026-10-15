import { describe, it, expect } from 'vitest'
import { buildCoachSystemPrompt, detectDumpRequest, COACH_SYSTEM_TEMPLATE } from './coach'

describe('buildCoachSystemPrompt', () => {
  it('プレースホルダがすべて埋まり、個人情報は含めない', () => {
    const out = buildCoachSystemPrompt({
      courseName: 'FDEスクール', assignmentTitle: 'ケース：受発注の滞留',
      skillLevels: '顧客課題の言語化:2, AI活用:3', latestNextAction: '論点を1つに絞る',
    })
    expect(out).toContain('FDEスクール')
    expect(out).toContain('ケース：受発注の滞留')
    expect(out).toContain('顧客課題の言語化:2')
    expect(out).toContain('論点を1つに絞る')
    expect(out).not.toContain('{') // 未置換プレースホルダが残っていない
  })
  it('空の文脈でも壊れない（既定文言）', () => {
    const out = buildCoachSystemPrompt({ courseName: '', assignmentTitle: '', skillLevels: '', latestNextAction: '' })
    expect(out).not.toContain('{course_name}')
    expect(out).toContain('このコース')
  })
  it('テンプレートに重要ルールが含まれる', () => {
    expect(COACH_SYSTEM_TEMPLATE).toContain('答えを先に言わず')
    expect(COACH_SYSTEM_TEMPLATE).toContain('講師への相談')
  })
})

describe('detectDumpRequest', () => {
  it('答えの丸投げ要求を検知', () => {
    expect(detectDumpRequest('この課題の答えを全部教えて')).toBe(true)
    expect(detectDumpRequest('レポートを丸ごと書いて')).toBe(true)
    expect(detectDumpRequest('模範解答を教えてください')).toBe(true)
  })
  it('通常の相談は検知しない', () => {
    expect(detectDumpRequest('どこから考え始めればいいですか？')).toBe(false)
    expect(detectDumpRequest('ボトルネックの見つけ方のヒントがほしい')).toBe(false)
  })
})
