'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  taskId: string
  startedAt: string | null
  timeLimitMinutes: number | null
}

export function TimedStart({ taskId, startedAt, timeLimitMinutes }: Props) {
  const [loading, setLoading] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!startedAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [startedAt])

  if (!startedAt) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800 mb-3">
          これは時間制限付きの実戦課題です（制限 {timeLimitMinutes ?? '—'} 分）。
          「開始」を押すと課題文と資料が表示され、残り時間の計測が始まります。piponの「朝ヒアリング → 午後デプロイ」を再現する想定です。
        </p>
        <Button
          loading={loading}
          onClick={async () => {
            setLoading(true)
            try {
              const res = await fetch('/api/review/start', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId }),
              })
              if (res.ok) window.location.reload()
            } finally { setLoading(false) }
          }}
        >
          開始する
        </Button>
      </div>
    )
  }

  if (!timeLimitMinutes) return null
  const due = new Date(startedAt).getTime() + timeLimitMinutes * 60000
  const remain = due - now
  const over = remain < 0
  const abs = Math.abs(remain)
  const hh = Math.floor(abs / 3600000)
  const mm = Math.floor((abs % 3600000) / 60000)
  const ss = Math.floor((abs % 60000) / 1000)
  const fmt = `${hh > 0 ? hh + ':' : ''}${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`

  return (
    <div className={`rounded-lg border p-3 text-center ${over ? 'border-red-300 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
      <div className={`text-2xl font-bold tabular-nums ${over ? 'text-red-700' : 'text-blue-700'}`}>{over ? '時間超過 +' : '残り '} {fmt}</div>
      <p className="text-xs text-gray-500 mt-1">{over ? '提出は可能ですが「時間超過」として記録されます。' : '時間内の提出を目指しましょう。'}</p>
    </div>
  )
}
