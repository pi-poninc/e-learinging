'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function CohortCreateForm({ courses }: { courses: { id: string; title: string }[] }) {
  const [courseId, setCourseId] = useState(courses[0]?.id || '')
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm text-gray-600 mb-1">コース</label>
        <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>
      <Input label="期の名前（例: 第3期）" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="開始日" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Input label="終了日" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button loading={loading} disabled={loading || !courseId || !name.trim()}
        onClick={async () => {
          setError(null); setLoading(true)
          try {
            const res = await fetch('/api/admin/cohorts', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'create', courseId, name: name.trim(), startDate, endDate }),
            })
            const data = await res.json()
            if (!res.ok) { setError(data.error || '作成に失敗しました'); return }
            window.location.href = `/admin/cohorts/${data.id}`
          } finally { setLoading(false) }
        }}>期を作成</Button>
    </div>
  )
}
