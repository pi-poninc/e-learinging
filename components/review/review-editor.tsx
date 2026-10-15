'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

interface RubricItem { id: string; label: string; max_level: number }

interface Props {
  submissionId: string
  claimedByMe: boolean
  claimedByOther: boolean
  initial?: { good: string; improvements: string; next: string }
  published?: boolean
  rubricItems?: RubricItem[]
}

export function ReviewEditor({ submissionId, claimedByMe, claimedByOther, initial, published, rubricItems = [] }: Props) {
  const [good, setGood] = useState(initial?.good || '')
  const [improvements, setImprovements] = useState(initial?.improvements || '')
  const [next, setNext] = useState(initial?.next || '')
  const [scores, setScores] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const call = async (path: string, body: object) => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '処理に失敗しました')
        return false
      }
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setLoading(false)
    }
  }

  if (published) {
    return <p className="text-sm text-green-700">この添削は公開済みです。</p>
  }

  if (claimedByOther) {
    return <p className="text-sm text-amber-700">他の添削者が担当中です。</p>
  }

  if (!claimedByMe) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">この提出を担当すると、あなたのキューに入り、他の添削者には表示されなくなります。</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button
          loading={loading}
          onClick={async () => { if (await call('/api/review/claim', { submissionId })) window.location.reload() }}
        >
          担当する
        </Button>
      </div>
    )
  }

  // claimedByMe
  return (
    <div className="space-y-4">
      {rubricItems.length > 0 && (
        <div className="space-y-2 rounded-md border border-gray-200 p-3">
          <p className="text-sm font-semibold text-gray-700">ルーブリック評価（スキルに反映されます）</p>
          {rubricItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700">{item.label}</span>
              <select
                className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                value={scores[item.id] ?? ''}
                onChange={(e) => setScores((s) => ({ ...s, [item.id]: Number(e.target.value) }))}
              >
                <option value="">—</option>
                {Array.from({ length: item.max_level }, (_, i) => i + 1).map((lv) => (
                  <option key={lv} value={lv}>Lv{lv}</option>
                ))}
              </select>
            </div>
          ))}
          <p className="text-xs text-gray-400">未選択の項目はスキルに反映されません。</p>
        </div>
      )}
      <Textarea label="良かった点（具体的に1〜3個／必須）" rows={4} value={good} onChange={(e) => setGood(e.target.value)} />
      <Textarea label="改善点（重要なものから最大3個）" rows={4} value={improvements} onChange={(e) => setImprovements(e.target.value)} />
      <Textarea label="次にやること（1つに絞る／必須）" rows={3} value={next} onChange={(e) => setNext(e.target.value)} />
      <p className="text-xs text-gray-500">初期（1〜5回目）の受講者には、改善点を絞り、良かった点を厚めに。</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <Button
          loading={loading}
          disabled={!good.trim() || !next.trim() || loading}
          onClick={async () => {
            const rubricScores = Object.fromEntries(Object.entries(scores).filter(([, v]) => v > 0))
            if (await call('/api/review/publish', { submissionId, goodPoints: good.trim(), improvements: improvements.trim(), nextAction: next.trim(), rubricScores })) {
              window.location.href = '/admin/review-queue'
            }
          }}
        >
          公開する
        </Button>
        <Button
          variant="ghost"
          loading={loading}
          onClick={async () => { if (await call('/api/review/release', { submissionId })) window.location.href = '/admin/review-queue' }}
        >
          担当を解除
        </Button>
      </div>
    </div>
  )
}
