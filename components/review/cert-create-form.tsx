'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function CertCreateForm({ courses }: { courses: { id: string; title: string }[] }) {
  const [courseId, setCourseId] = useState(courses[0]?.id || '')
  const [name, setName] = useState('')
  const [gradeLevel, setGradeLevel] = useState('6')
  const [demoDay, setDemoDay] = useState(true)
  const [validity, setValidity] = useState('24')
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
      <Input label="認定名（例: pipon認定FDE）" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="必要グレード（段階）" type="number" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} />
        <Input label="有効期間（月・空で無期限）" type="number" value={validity} onChange={(e) => setValidity(e.target.value)} />
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={demoDay} onChange={(e) => setDemoDay(e.target.checked)} /> デモデイ参加を必須にする
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button loading={loading} disabled={loading || !courseId || !name.trim()} onClick={async () => {
        setError(null); setLoading(true)
        try {
          const requirements: Record<string, unknown> = {}
          if (gradeLevel) requirements.grade_level = Number(gradeLevel)
          if (demoDay) requirements.demo_day = true
          const res = await fetch('/api/admin/certifications', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create', courseId, name: name.trim(), requirements, validityMonths: validity ? Number(validity) : null }),
          })
          const data = await res.json()
          if (!res.ok) { setError(data.error || '作成に失敗しました'); return }
          window.location.reload()
        } finally { setLoading(false) }
      }}>認定を作成</Button>
    </div>
  )
}
