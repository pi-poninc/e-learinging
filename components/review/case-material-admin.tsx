'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Item {
  id: string; title: string; background: string | null
  anonymization_status: string; piiWarning: boolean
}

export function CaseMaterialAdmin({ items }: { items: Item[] }) {
  const [title, setTitle] = useState('')
  const [background, setBackground] = useState('')
  const [modelAnswer, setModelAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const post = async (payload: object) => {
    setError(null); setBusy(true)
    try {
      const res = await fetch('/api/admin/case-materials', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '失敗しました'); return false }
      window.location.reload(); return true
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">ケース教材を追加</h2></CardHeader>
        <CardBody>
          <div className="space-y-3">
            <Input label="タイトル" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea label="背景（匿名化済みの本文）" rows={4} value={background} onChange={(e) => setBackground(e.target.value)} />
            <Textarea label="模範解答・講評（提出後に受講者へ開示）" rows={3} value={modelAnswer} onChange={(e) => setModelAnswer(e.target.value)} />
            <p className="text-xs text-gray-500">※ 追加時は「draft」。顧客名・個人名・連絡先が残っていないか確認し、承認して初めて課題に使えます。</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button loading={busy} disabled={!title.trim() || busy}
              onClick={() => post({ action: 'create', title: title.trim(), background: background.trim(), modelAnswer: modelAnswer.trim() })}>
              追加する
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-gray-500">ケース教材はまだありません。</p>}
        {items.map((it) => (
          <Card key={it.id}><CardBody>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{it.title}</span>
                  <Badge variant={it.anonymization_status === 'approved' ? 'success' : 'warning'}>{it.anonymization_status}</Badge>
                  {it.piiWarning && <Badge variant="danger">要確認：個人情報の疑い</Badge>}
                </div>
                {it.background && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{it.background}</p>}
              </div>
              <div className="shrink-0 flex gap-2">
                {it.anonymization_status !== 'approved'
                  ? <Button size="sm" loading={busy} onClick={() => post({ action: 'approve', id: it.id })}>匿名化を承認</Button>
                  : <Button size="sm" variant="ghost" loading={busy} onClick={() => post({ action: 'revert', id: it.id })}>承認を取消</Button>}
              </div>
            </div>
          </CardBody></Card>
        ))}
      </div>
    </div>
  )
}
