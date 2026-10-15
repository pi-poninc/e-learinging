import { describe, it, expect } from 'vitest'
import {
  learningDay, nextSubmitAt, slaDueAt, weekStartOf, isConsecutiveDay,
} from './learning-day'

// JST = UTC+9。学習日の切り替えは午前4時（既定）。
describe('learningDay (Asia/Tokyo, 午前4時境界)', () => {
  it('JST 03:59 は前日扱い', () => {
    // JST 2026-03-10 03:59 = UTC 2026-03-09 18:59
    expect(learningDay(new Date('2026-03-09T18:59:00Z'))).toBe('2026-03-09')
  })
  it('JST 04:00 ちょうどは当日', () => {
    // JST 2026-03-10 04:00 = UTC 2026-03-09 19:00
    expect(learningDay(new Date('2026-03-09T19:00:00Z'))).toBe('2026-03-10')
  })
  it('JST 昼15:00 は当日', () => {
    // JST 2026-03-10 15:00 = UTC 2026-03-10 06:00
    expect(learningDay(new Date('2026-03-10T06:00:00Z'))).toBe('2026-03-10')
  })
  it('JST 翌00:30 は（4時前なので）まだ前日扱い＝月跨ぎ', () => {
    // JST 2026-04-01 00:30 = UTC 2026-03-31 15:30 → 学習日は 2026-03-31
    expect(learningDay(new Date('2026-03-31T15:30:00Z'))).toBe('2026-03-31')
  })
  it('境界時刻はコース設定で変えられる（午前0時境界なら素直な日付）', () => {
    // JST 2026-03-10 03:59、境界0時 → 当日
    expect(learningDay(new Date('2026-03-09T18:59:00Z'), { dayBoundaryHour: 0 })).toBe('2026-03-10')
  })
})

describe('nextSubmitAt', () => {
  it('JST 03:59 の次の提出可能時刻は JST 翌(=当日)04:00', () => {
    // JST 2026-03-10 03:59 (UTC 2026-03-09T18:59Z) → 次は JST 2026-03-10 04:00 = UTC 2026-03-09T19:00Z
    expect(nextSubmitAt(new Date('2026-03-09T18:59:00Z')).toISOString()).toBe('2026-03-09T19:00:00.000Z')
  })
  it('JST 昼の次の提出可能時刻は翌日04:00', () => {
    // JST 2026-03-10 15:00 (UTC 06:00) → 次は JST 2026-03-11 04:00 = UTC 2026-03-10T19:00Z
    expect(nextSubmitAt(new Date('2026-03-10T06:00:00Z')).toISOString()).toBe('2026-03-10T19:00:00.000Z')
  })
})

describe('slaDueAt', () => {
  it('24時間後', () => {
    expect(slaDueAt(new Date('2026-03-10T06:00:00Z'), 24).toISOString()).toBe('2026-03-11T06:00:00.000Z')
  })
})

describe('weekStartOf', () => {
  // 2026-03-11 は水曜
  it('月曜始まり', () => {
    expect(weekStartOf('2026-03-11', 'monday')).toBe('2026-03-09')
  })
  it('日曜始まり', () => {
    expect(weekStartOf('2026-03-11', 'sunday')).toBe('2026-03-08')
  })
  it('月曜当日は自分自身', () => {
    expect(weekStartOf('2026-03-09', 'monday')).toBe('2026-03-09')
  })
})

describe('isConsecutiveDay', () => {
  it('連続', () => {
    expect(isConsecutiveDay('2026-03-09', '2026-03-10')).toBe(true)
  })
  it('月跨ぎの連続', () => {
    expect(isConsecutiveDay('2026-03-31', '2026-04-01')).toBe(true)
  })
  it('飛んでいる', () => {
    expect(isConsecutiveDay('2026-03-09', '2026-03-11')).toBe(false)
  })
})
