'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function GradeActions({ userGradeId }: { userGradeId: string }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const act = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !reason.trim()) { setError('差し戻しには理由が必要です'); return }
    setError(null); setLoading(true)
    try {
      const res = await fetch('/api/review/grade', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userGradeId, action, reason: reason.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '処理に失敗しました'); return }
      window.location.reload()
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button size="sm" loading={loading} onClick={() => act('approve')}>承認</Button>
        <Button size="sm" variant="danger" loading={loading} onClick={() => act('reject')}>差し戻し</Button>
      </div>
      <Input placeholder="差し戻しの理由（差し戻し時は必須）" value={reason} onChange={(e) => setReason(e.target.value)} />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
