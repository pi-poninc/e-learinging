'use client'

import { Button } from '@/components/ui/button'

interface Props {
  rows: Record<string, string | number>[]
  headers: { key: string; label: string }[]
  filename: string
}

function toCsv(rows: Record<string, string | number>[], headers: { key: string; label: string }[]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = headers.map((h) => esc(h.label)).join(',')
  const body = rows.map((r) => headers.map((h) => esc(r[h.key])).join(',')).join('\n')
  return '﻿' + head + '\n' + body // BOM付き（Excelで日本語が化けない）
}

export function ReportExportButton({ rows, headers, filename }: Props) {
  const download = () => {
    const blob = new Blob([toCsv(rows, headers)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <Button variant="secondary" size="sm" onClick={download} disabled={rows.length === 0}>
      CSV書き出し（{rows.length}件）
    </Button>
  )
}
