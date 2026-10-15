'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  entryId: string
  skills: { id: string; name: string }[]
  guestToken?: string
}

export function DemoEvalForm({ entryId, skills, guestToken }: Props) {
  const [scores, setScores] = useState<Record<string, number>>({})
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (done) return <p className="text-sm text-green-700">評価を送信しました。ありがとうございました。</p>

  return (
    <div className="space-y-2">
      {skills.map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-3">
          <span className="text-sm text-gray-700">{s.name}</span>
          <select className="rounded-md border border-gray-300 px-2 py-1 text-sm" value={scores[s.id] ?? ''}
            onChange={(e) => setScores((p) => ({ ...p, [s.id]: Number(e.target.value) }))}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      ))}
      <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="コメント（任意）" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button size="sm" loading={loading} onClick={async () => {
        setError(null); setLoading(true)
        try {
          const cleanScores = Object.fromEntries(Object.entries(scores).filter(([, v]) => v > 0))
          const endpoint = guestToken ? '/api/demo-day/guest' : '/api/demo-day'
          const payload = guestToken
            ? { token: guestToken, entryId, scores: cleanScores, comment: comment.trim() }
            : { action: 'evaluate', entryId, scores: cleanScores, comment: comment.trim() }
          const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          const data = await res.json()
          if (!res.ok) { setError(data.error || '送信に失敗しました'); return }
          setDone(true)
        } finally { setLoading(false) }
      }}>評価を送る</Button>
    </div>
  )
}
