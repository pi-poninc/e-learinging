'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function OrgCreateForm() {
  const [name, setName] = useState('')
  const [plan, setPlan] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="space-y-3">
      <Input label="企業名" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-3 gap-3">
        <Input label="プラン" value={plan} onChange={(e) => setPlan(e.target.value)} />
        <Input label="契約開始" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input label="契約終了" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button loading={loading} disabled={loading || !name.trim()} onClick={async () => {
        setError(null); setLoading(true)
        try {
          const res = await fetch('/api/admin/organizations', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create', name: name.trim(), plan: plan.trim(), contractStart: start, contractEnd: end }),
          })
          const data = await res.json()
          if (!res.ok) { setError(data.error || '作成に失敗しました'); return }
          window.location.href = `/admin/organizations/${data.id}`
        } finally { setLoading(false) }
      }}>企業を作成</Button>
    </div>
  )
}

export function OrgContractToggles({ organizationId, submissionContent, coachLogs }: { organizationId: string; submissionContent: boolean; coachLogs: boolean }) {
  const [sc, setSc] = useState(submissionContent)
  const [cl, setCl] = useState(coachLogs)
  const save = async (patch: object) => {
    await fetch('/api/admin/organizations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_contract', organizationId, ...patch }) })
  }
  return (
    <div className="space-y-2 text-sm text-gray-700">
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={sc} onChange={(e) => { setSc(e.target.checked); save({ showSubmissionContent: e.target.checked }) }} />
        企業管理者に「提出物の中身」を見せる（既定: 非表示）
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={cl} onChange={(e) => { setCl(e.target.checked); save({ showCoachLogs: e.target.checked }) }} />
        企業管理者に「AIコーチの会話」を見せる（既定: 非表示）
      </label>
    </div>
  )
}
