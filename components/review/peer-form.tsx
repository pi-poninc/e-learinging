'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

export function PeerForm({ peerReviewId }: { peerReviewId: string }) {
  const [good, setGood] = useState('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      <Textarea label="良かった点" rows={2} value={good} onChange={(e) => setGood(e.target.value)} />
      <Textarea label="コメント（アドバイス・気づき）" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button loading={loading} disabled={loading || (!good.trim() && !comment.trim())}
        onClick={async () => {
          setError(null); setLoading(true)
          try {
            const res = await fetch('/api/review/peer', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'submit', peerReviewId, goodPoints: good.trim(), comment: comment.trim() }),
            })
            const data = await res.json()
            if (!res.ok) { setError(data.error || '失敗しました'); return }
            window.location.reload()
          } finally { setLoading(false) }
        }}>
        仲間にコメントを送る
      </Button>
    </div>
  )
}
