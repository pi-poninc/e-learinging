'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function GuestTokenButton({ cohortId }: { cohortId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      <Button size="sm" variant="secondary" loading={loading} onClick={async () => {
        setError(null); setLoading(true)
        try {
          const res = await fetch('/api/demo-day', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'guest_token', cohortId, expiresInDays: 14 }),
          })
          const data = await res.json()
          if (!res.ok) { setError(data.error || '発行に失敗しました'); return }
          setUrl(`${window.location.origin}/demo/${data.token}`)
        } finally { setLoading(false) }
      }}>ゲスト評価URLを発行（14日間）</Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {url && (
        <div className="text-xs">
          <p className="text-gray-500 mb-1">このURLを外部評価者に共有してください（ログイン不要）:</p>
          <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="w-full rounded border border-gray-300 px-2 py-1 font-mono" />
        </div>
      )}
    </div>
  )
}
