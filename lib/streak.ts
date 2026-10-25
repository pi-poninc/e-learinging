/**
 * 連続学習日（ストリーク）の計算（純関数）。
 * 学習日は Asia/Tokyo・午前4時境界（lib/learning-day.ts と同じ定義）。
 * 「今日 or 昨日」に活動があれば現在のストリークは生きている。
 */
import { learningDay, isConsecutiveDay } from './learning-day'

export interface StreakResult {
  current: number   // 現在のストリーク（今日/昨日まで続いていれば>0）
  longest: number   // 最長ストリーク
  lastActiveDay: string | null
  activeDays: number // 学習した日数（ユニーク）
}

/**
 * @param timestamps 完了アクティビティの時刻（Date か ISO文字列）の配列
 * @param now 基準時刻（既定 現在）
 */
export function computeStreak(timestamps: Array<string | Date>, now: Date = new Date()): StreakResult {
  const days = Array.from(
    new Set(timestamps.map((t) => learningDay(t instanceof Date ? t : new Date(t)))),
  ).sort() // 昇順の YYYY-MM-DD

  if (days.length === 0) return { current: 0, longest: 0, lastActiveDay: null, activeDays: 0 }

  // 最長ストリーク
  let longest = 1
  let run = 1
  for (let i = 1; i < days.length; i++) {
    if (isConsecutiveDay(days[i - 1], days[i])) {
      run += 1
    } else {
      run = 1
    }
    if (run > longest) longest = run
  }

  // 現在のストリーク：末尾の日から遡って連続数を数え、
  // 末尾が「今日」か「昨日」でなければ途切れている（current=0）。
  const today = learningDay(now)
  const yesterday = (() => {
    const d = new Date(now)
    d.setDate(d.getDate() - 1)
    return learningDay(d)
  })()
  const last = days[days.length - 1]
  let current = 0
  if (last === today || last === yesterday) {
    current = 1
    for (let i = days.length - 1; i > 0; i--) {
      if (isConsecutiveDay(days[i - 1], days[i])) current += 1
      else break
    }
  }

  return { current, longest, lastActiveDay: last, activeDays: days.length }
}
