'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Props {
  taskId: string
  submissionTypes: string[]
  encouragement: string
}

export function ReviewSubmitForm({ taskId, submissionTypes, encouragement }: Props) {
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ n: number; sla: number } | null>(null)

  const allowText = submissionTypes.includes('text')
  const allowUrl = submissionTypes.includes('url')

  const submit = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/review/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          contentText: allowText && text.trim() ? text.trim() : undefined,
          contentUrl: allowUrl && url.trim() ? url.trim() : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '提出に失敗しました')
        return
      }
      setDone({ n: data.submissionNumber, sla: data.slaHours })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // 提出直後の達成演出（毎回）
  if (done) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <div className="text-3xl mb-2">🎉</div>
        <p className="text-lg font-bold text-green-800">提出おつかれさまでした！</p>
        <p className="text-sm text-green-700 mt-1">合計 {done.n} 回目の提出です。</p>
        <p className="text-sm text-gray-600 mt-3">
          添削は {done.sla} 時間以内に返ってきます。通知が届いたら確認しましょう。
        </p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          学習に戻る
        </Button>
      </div>
    )
  }

  const canSubmit = (allowText && text.trim().length > 0) || (allowUrl && url.trim().length > 0)

  return (
    <div className="space-y-4">
      {allowText && (
        <Textarea
          label="提出テキスト"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="取り組んだこと・作ったもの・気づきなどを書いてください"
        />
      )}
      {allowUrl && (
        <Input
          label="URL（作ったもの・資料など）"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
        />
      )}
      <p className="text-sm text-gray-500">{encouragement}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={submit} loading={loading} disabled={!canSubmit || loading}>
        提出する
      </Button>
    </div>
  )
}
