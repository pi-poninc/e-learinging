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
  aiDraftEnabled?: boolean
  isExemplar?: boolean
}

export function ReviewEditor({ submissionId, claimedByMe, claimedByOther, initial, published, rubricItems = [], aiDraftEnabled, isExemplar }: Props) {
  const [good, setGood] = useState(initial?.good || '')
  const [improvements, setImprovements] = useState(initial?.improvements || '')
  const [next, setNext] = useState(initial?.next || '')
  const [scores, setScores] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exemplar, setExemplar] = useState(!!isExemplar)

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
    return (
      <div className="space-y-2">
        <p className="text-sm text-green-700">この添削は公開済みです。</p>
        <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={exemplar} onChange={async (e) => {
            const v = e.target.checked; setExemplar(v)
            await fetch('/api/review/ai-draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark_exemplar', submissionId, value: v }) })
          }} />
          良い添削の例として登録（AI下書きの参考に使う）
        </label>
      </div>
    )
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
      {aiDraftEnabled && (
        <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3">
          <Button size="sm" variant="secondary" loading={aiLoading} onClick={async () => {
            setError(null); setAiLoading(true)
            try {
              const res = await fetch('/api/review/ai-draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submissionId }) })
              const data = await res.json()
              if (!res.ok) { setError(data.error || 'AI下書きの生成に失敗しました'); return }
              const d = data.draft || {}
              if (d.good_points) setGood(d.good_points)
              if (d.improvements) setImprovements(d.improvements)
              if (d.next_action) setNext(d.next_action)
              if (d.rubric_scores) {
                const known = new Set(rubricItems.map((r) => r.id))
                setScores(Object.fromEntries(Object.entries(d.rubric_scores as Record<string, number>).filter(([k]) => known.has(k))))
              }
            } finally { setAiLoading(false) }
          }}>✨ AI下書きを生成</Button>
          <p className="text-xs text-gray-500 mt-1">下書きはそのまま公開せず、必ず確認・編集してください。AIの文面は受講者には表示されません。</p>
        </div>
      )}
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
