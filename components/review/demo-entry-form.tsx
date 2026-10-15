'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  cohortId: string
  initial?: { title: string; description: string; videoUrl: string; demoUrl: string }
}

export function DemoEntryForm({ cohortId, initial }: Props) {
  const [title, setTitle] = useState(initial?.title || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl || '')
  const [demoUrl, setDemoUrl] = useState(initial?.demoUrl || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      <Input label="発表タイトル" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea label="説明" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      <Input label="デモ動画URL" type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://..." />
      <Input label="デモURL（作ったもの）" type="url" value={demoUrl} onChange={(e) => setDemoUrl(e.target.value)} placeholder="https://..." />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button loading={loading} disabled={loading || !title.trim()} onClick={async () => {
        setError(null); setLoading(true)
        try {
          const res = await fetch('/api/demo-day', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'entry', cohortId, title: title.trim(), description: description.trim(), videoUrl: videoUrl.trim(), demoUrl: demoUrl.trim() }),
          })
          const data = await res.json()
          if (!res.ok) { setError(data.error || '保存に失敗しました'); return }
          window.location.reload()
        } finally { setLoading(false) }
      }}>{initial ? '発表を更新' : '発表を登録'}</Button>
    </div>
  )
}
