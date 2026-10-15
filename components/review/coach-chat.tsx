'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface Msg { role: 'user' | 'assistant'; content: string }

export function CoachChat({ taskId, initial }: { taskId: string; initial: Msg[] }) {
  const [messages, setMessages] = useState<Msg[]>(initial)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    const text = input.trim()
    if (!text) return
    setError(null); setLoading(true)
    setMessages((m) => [...m, { role: 'user', content: text }])
    setInput('')
    try {
      const res = await fetch('/api/coach', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, message: text }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '送信に失敗しました'); return }
      setMessages((m) => [...m, { role: 'assistant', content: data.reply }])
    } catch (e) {
      setError((e as Error).message)
    } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-3 max-h-[55vh] overflow-y-auto rounded-lg border border-gray-200 bg-white p-4">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400">詰まっている点や、考え方の相談をどうぞ。答えは出しませんが、一緒に整理します。</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
              m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
              {m.content}
            </div>
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2 items-end">
        <div className="flex-1"><Textarea rows={2} value={input} onChange={(e) => setInput(e.target.value)} placeholder="例：ボトルネックの見つけ方のヒントがほしい" /></div>
        <Button onClick={send} loading={loading} disabled={loading || !input.trim()}>送る</Button>
      </div>
    </div>
  )
}
