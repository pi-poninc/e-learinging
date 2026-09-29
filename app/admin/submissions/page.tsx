'use client'

import { useState, useEffect, useCallback } from 'react'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Submission {
  id: string
  title: string
  body: string
  reference_url: string | null
  status: string
  admin_note: string | null
  course_id: string | null
  submitterName: string
  courseTitle: string | null
  created_at: string
}
interface Course { id: string; title: string }

const STATUS: { value: string; label: string; variant: 'info' | 'warning' | 'success' | 'danger' }[] = [
  { value: 'new', label: '未対応', variant: 'info' },
  { value: 'in_progress', label: '制作中', variant: 'warning' },
  { value: 'done', label: '公開済み', variant: 'success' },
  { value: 'rejected', label: '見送り', variant: 'danger' },
]

export default function AdminSubmissionsPage() {
  const [subs, setSubs] = useState<Submission[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/submissions')
    if (res.ok) {
      const d = await res.json()
      setSubs(d.submissions || [])
      setCourses(d.courses || [])
    }
  }, [])
  useEffect(() => { load() }, [load])

  const update = async (id: string, patch: Record<string, unknown>) => {
    await fetch('/api/admin/submissions', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    })
    await load()
  }

  const shown = filter === 'all' ? subs : subs.filter((s) => s.status === filter)
  const counts = STATUS.map((st) => ({ ...st, n: subs.filter((s) => s.status === st.value).length }))

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">ネタ投稿管理</h1>
      <p className="text-sm text-gray-500 mb-6">メンバーから投稿された「動画コンテンツのネタ」の一覧です。ステータスを更新し、動画化したら講座を紐づけてください。</p>

      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded-md text-sm ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
          すべて（{subs.length}）
        </button>
        {counts.map((c) => (
          <button key={c.value} onClick={() => setFilter(c.value)} className={`px-3 py-1 rounded-md text-sm ${filter === c.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
            {c.label}（{c.n}）
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card><CardBody><p className="text-sm text-gray-500 py-6 text-center">該当する投稿はありません。</p></CardBody></Card>
      ) : (
        <div className="space-y-4">
          {shown.map((s) => {
            const st = STATUS.find((x) => x.value === s.status) || STATUS[0]
            return (
              <Card key={s.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{s.title}</h3>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{s.submitterName}・{(s.created_at || '').slice(0, 10)}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{s.body}</p>
                  {s.reference_url && (
                    <a href={s.reference_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline break-all">
                      参考リンク: {s.reference_url}
                    </a>
                  )}

                  <div className="mt-4 grid gap-3 sm:grid-cols-3 border-t border-gray-100 pt-3">
                    <label className="text-sm text-gray-600">
                      ステータス
                      <select value={s.status} onChange={(e) => update(s.id, { status: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                        {STATUS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                      </select>
                    </label>
                    <label className="text-sm text-gray-600">
                      紐づけ講座
                      <select value={s.course_id || ''} onChange={(e) => update(s.id, { courseId: e.target.value || null })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                        <option value="">（未紐づけ）</option>
                        {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                    </label>
                    <label className="text-sm text-gray-600">
                      管理メモ
                      <input defaultValue={s.admin_note || ''} onBlur={(e) => update(s.id, { adminNote: e.target.value })}
                        placeholder="担当・進捗など" className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                    </label>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}
    </AdminLayout>
  )
}
