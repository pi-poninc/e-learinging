/**
 * 受講記録のCSV生成（純関数）。項目は後から追加できるよう、ヘッダと行を配列で受ける。
 * 学習時間は近似（提出ごとに課題の目安時間、無ければ既定分）。厳密計測は将来 learning_events 拡張で。
 */
export const DEFAULT_MINUTES_PER_SUBMISSION = 30

export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    const s = v == null ? '' : String(v)
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const lines = [headers, ...rows].map((r) => r.map(esc).join(','))
  // Excel(日本語)向けに BOM を付ける
  return '﻿' + lines.join('\r\n')
}

export const RECORD_HEADERS = [
  '受講者名', 'メール', '提出件数', '提出日数', '添削受領数', '学習時間(分・近似)', '最高グレード', '取得認定数', '最新認定番号', '最新認定発行日',
]
