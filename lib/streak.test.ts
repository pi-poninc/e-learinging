import { describe, it, expect } from 'vitest'
import { computeStreak } from './streak'

// JST 4時境界。UTC+9。学習日はおおむね日付通り（朝4時前は前日扱い）。
const at = (ymd: string, hour = 12) => new Date(`${ymd}T${String(hour - 9).padStart(2, '0')}:00:00Z`) // JST hour時

describe('computeStreak', () => {
  it('活動なしは0', () => {
    expect(computeStreak([], new Date('2026-10-25T12:00:00Z'))).toEqual({
      current: 0, longest: 0, lastActiveDay: null, activeDays: 0,
    })
  })

  it('今日まで3日連続', () => {
    const now = at('2026-10-25')
    const r = computeStreak([at('2026-10-23'), at('2026-10-24'), at('2026-10-25')], now)
    expect(r.current).toBe(3)
    expect(r.longest).toBe(3)
    expect(r.activeDays).toBe(3)
  })

  it('同じ日に複数活動は1日として数える', () => {
    const now = at('2026-10-25')
    const r = computeStreak([at('2026-10-25', 9), at('2026-10-25', 13), at('2026-10-25', 20)], now)
    expect(r.current).toBe(1)
    expect(r.activeDays).toBe(1)
  })

  it('昨日までの連続は current に含む（今日未活動でも生きている）', () => {
    const now = at('2026-10-25')
    const r = computeStreak([at('2026-10-23'), at('2026-10-24')], now)
    expect(r.current).toBe(2)
  })

  it('2日以上空くと current は途切れる（0）が longest は残る', () => {
    const now = at('2026-10-25')
    const r = computeStreak([at('2026-10-20'), at('2026-10-21'), at('2026-10-22')], now)
    expect(r.current).toBe(0)
    expect(r.longest).toBe(3)
  })

  it('途中に穴があると longest は最長の連続run', () => {
    const now = at('2026-10-25')
    const r = computeStreak([
      at('2026-10-10'), at('2026-10-11'), // run 2
      at('2026-10-20'), at('2026-10-21'), at('2026-10-22'), // run 3
      at('2026-10-25'), // 今日（単独）
    ], now)
    expect(r.longest).toBe(3)
    expect(r.current).toBe(1)
  })
})
