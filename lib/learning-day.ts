/**
 * 学習日（learning day）とSLA・週の計算。すべて純関数でサーバー側に集約する。
 * - 日時はUTCで保存し、判定はコースのタイムゾーン＋切り替え時刻（既定 Asia/Tokyo 午前4時）で行う。
 * - クライアントの時計は信用しない。ここを1か所に集約し、境界値をテストする（learning-day.test.ts）。
 */

export const DEFAULT_TIMEZONE = 'Asia/Tokyo'
export const DEFAULT_DAY_BOUNDARY_HOUR = 4

export interface DayOptions {
  timezone?: string
  dayBoundaryHour?: number
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** ある瞬間を、指定タイムゾーンの壁時計（年月日時分）に分解する。 */
export function zonedParts(date: Date, timezone: string): {
  year: number; month: number; day: number; hour: number; minute: number
} {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const parts: Record<string, string> = {}
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = p.value
  }
  let hour = parseInt(parts.hour, 10)
  if (hour === 24) hour = 0 // 一部環境で深夜0時が '24' になるのを吸収
  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour,
    minute: parseInt(parts.minute, 10),
  }
}

/**
 * 学習日を 'YYYY-MM-DD' で返す。
 * 切り替え時刻より前（例: 午前4時より前）の提出は前日扱い。
 */
export function learningDay(date: Date, opts: DayOptions = {}): string {
  const tz = opts.timezone ?? DEFAULT_TIMEZONE
  const boundary = opts.dayBoundaryHour ?? DEFAULT_DAY_BOUNDARY_HOUR
  const p = zonedParts(date, tz)
  // tz壁時計の日付をUTC正午基準で持つ（DST等の影響を避けるため正午を使う）
  const base = new Date(Date.UTC(p.year, p.month - 1, p.day, 12, 0, 0))
  if (p.hour < boundary) {
    base.setUTCDate(base.getUTCDate() - 1)
  }
  return `${base.getUTCFullYear()}-${pad2(base.getUTCMonth() + 1)}-${pad2(base.getUTCDate())}`
}

/** 次に提出できる時刻（＝学習日の次の切り替え時刻）を Date で返す。UIの「次は◯時」表示用。 */
export function nextSubmitAt(date: Date, opts: DayOptions = {}): Date {
  const tz = opts.timezone ?? DEFAULT_TIMEZONE
  const boundary = opts.dayBoundaryHour ?? DEFAULT_DAY_BOUNDARY_HOUR
  const p = zonedParts(date, tz)
  // その瞬間のtz壁時計の「今日の境界時刻」をUTCへ写すため、オフセットを実測する
  const asUTCguess = new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute))
  const offsetMs = asUTCguess.getTime() - new Date(date.getTime() - (date.getTime() % 60000)).getTime()
  // 今日の境界（tz壁時計で boundary:00）をUTCへ
  let boundaryUTC = new Date(Date.UTC(p.year, p.month - 1, p.day, boundary, 0, 0) - offsetMs)
  if (boundaryUTC.getTime() <= date.getTime()) {
    boundaryUTC = new Date(boundaryUTC.getTime() + 24 * 3600 * 1000)
  }
  return boundaryUTC
}

/** submitted_at + sla_hours。 */
export function slaDueAt(submittedAt: Date, slaHours: number): Date {
  return new Date(submittedAt.getTime() + slaHours * 3600 * 1000)
}

/**
 * 学習日（'YYYY-MM-DD'）が属する週の開始日を 'YYYY-MM-DD' で返す。
 * weekStart は 'monday' / 'sunday'。週目標・連続週数の集計キーに使う。
 */
export function weekStartOf(learningDayStr: string, weekStart: 'monday' | 'sunday' = 'monday'): string {
  const [y, m, d] = learningDayStr.split('-').map((n) => parseInt(n, 10))
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay() // 0=Sun..6=Sat
  const offset = weekStart === 'monday' ? (dow + 6) % 7 : dow
  dt.setUTCDate(dt.getUTCDate() - offset)
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
}

/** 2つの学習日が連続（1日違い）かどうか。連続記録の判定に使う。 */
export function isConsecutiveDay(prev: string, next: string): boolean {
  const toUTC = (s: string) => {
    const [y, m, d] = s.split('-').map((n) => parseInt(n, 10))
    return Date.UTC(y, m - 1, d)
  }
  return toUTC(next) - toUTC(prev) === 24 * 3600 * 1000
}
