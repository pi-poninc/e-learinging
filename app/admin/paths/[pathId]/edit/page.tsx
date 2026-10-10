'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import type { LearningPath, PathItem } from '@/lib/db'

type ItemRow = PathItem & { course?: { id: string; title: string } }

export default function EditPathPage() {
  const params = useParams()
  const pathId = params.pathId as string
  const supabase = useMemo(() => createClient(), [])

  const [path, setPath] = useState<LearningPath | null>(null)
  const [items, setItems] = useState<ItemRow[]>([])
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  // add-item form
  const [courseId, setCourseId] = useState('')
  const [milestone, setMilestone] = useState('')
  const [targetDays, setTargetDays] = useState('')

  const load = useCallback(async () => {
    const [{ data: p }, { data: its }, { data: cs }] = await Promise.all([
      supabase.from('learning_paths').select('*').eq('id', pathId).single(),
      supabase.from('path_items').select('*, course:courses(id, title)').eq('path_id', pathId).order('sort_order'),
      supabase.from('courses').select('id, title').order('title'),
    ])
    if (p) setPath(p as LearningPath)
    setItems((its || []) as ItemRow[])
    setCourses((cs || []) as { id: string; title: string }[])
    setLoading(false)
  }, [pathId, supabase])
  useEffect(() => { load() }, [load])

  const saveMeta = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setSaving(true); setNotice('')
    const fd = new FormData(e.currentTarget)
    await supabase.from('learning_paths').update({
      title: fd.get('title') as string,
      description: (fd.get('description') as string) || null,
      status: fd.get('status') as string,
      sort_order: parseInt((fd.get('sort_order') as string) || '0', 10),
    }).eq('id', pathId)
    setNotice('基本情報を保存しました。'); setSaving(false)
  }

  const addItem = async () => {
    if (!courseId) return
    const maxOrder = items.reduce((m, i) => Math.max(m, i.sort_order), -1)
    await supabase.from('path_items').insert({
      path_id: pathId, course_id: courseId,
      milestone_label: milestone || null,
      target_days: targetDays ? parseInt(targetDays, 10) : null,
      sort_order: maxOrder + 1,
    })
    setCourseId(''); setMilestone(''); setTargetDays(''); load()
  }

  const delItem = async (id: string) => { await supabase.from('path_items').delete().eq('id', id); load() }

  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir
    if (j < 0 || j >= items.length) return
    const a = items[idx], b = items[j]
    await Promise.all([
      supabase.from('path_items').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('path_items').update({ sort_order: a.sort_order }).eq('id', b.id),
    ])
    load()
  }

  if (loading) return <AdminLayout><p className="text-gray-500">読み込み中...</p></AdminLayout>
  if (!path) return <AdminLayout><p className="text-red-600">見つかりません。</p></AdminLayout>

  return (
    <AdminLayout>
      <div className="mb-4 flex items-center justify-between">
        <Link href="/admin/paths" className="text-sm text-blue-600 hover:text-blue-700">&larr; ロードマップ一覧</Link>
        <Link href="/journey" target="_blank"><Button variant="secondary" size="sm">受講者ビュー ↗</Button></Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">ロードマップを編集</h1>
      {notice && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">{notice}</div>}

      <Card className="mb-6 max-w-2xl">
        <CardHeader><h2 className="text-lg font-semibold">基本情報</h2></CardHeader>
        <CardBody>
          <form onSubmit={saveMeta} className="space-y-4">
            <Input label="タイトル" name="title" required defaultValue={path.title} />
            <Textarea label="説明" name="description" defaultValue={path.description || ''} />
            <Input label="並び順" name="sort_order" type="number" defaultValue={String(path.sort_order)} />
            <Select label="ステータス" name="status" defaultValue={path.status} options={[
              { value: 'draft', label: '下書き' }, { value: 'published', label: '公開' }, { value: 'archived', label: 'アーカイブ' },
            ]} />
            <Button type="submit" loading={saving}>保存</Button>
          </form>
        </CardBody>
      </Card>

      <h2 className="text-xl font-bold text-gray-900 mb-3">コース（上から順に受講）</h2>
      <div className="space-y-2 mb-5 max-w-3xl">
        {items.length === 0 && <p className="text-sm text-gray-500">まだコースがありません。</p>}
        {items.map((it, idx) => (
          <Card key={it.id}>
            <CardBody className="py-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-xs text-gray-400 w-6">{String(idx + 1).padStart(2, '0')}</span>
                {it.milestone_label && <span className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">{it.milestone_label}</span>}
                <span className="text-sm font-medium text-gray-900 flex-1 min-w-0">{it.course?.title || it.course_id}</span>
                <span className="text-xs text-gray-500">{it.target_days != null ? `目安 ${it.target_days}日` : '目安なし'}</span>
                <button onClick={() => move(idx, -1)} className="text-gray-400 hover:text-gray-700 px-1" aria-label="上へ">↑</button>
                <button onClick={() => move(idx, 1)} className="text-gray-400 hover:text-gray-700 px-1" aria-label="下へ">↓</button>
                <Button variant="danger" size="sm" onClick={() => delItem(it.id)}>削除</Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card className="max-w-2xl">
        <CardHeader><h3 className="font-semibold">コースを追加</h3></CardHeader>
        <CardBody>
          <div className="grid sm:grid-cols-2 gap-3">
            <Select label="講座" value={courseId} onChange={(e) => setCourseId(e.target.value)}
              options={[{ value: '', label: '選択してください' }, ...courses.map((c) => ({ value: c.id, label: c.title }))]} />
            <Input label="マイルストーン名（任意）" placeholder="例: 商売の型" value={milestone} onChange={(e) => setMilestone(e.target.value)} />
            <Input label="目安日数（開始から, 任意）" type="number" placeholder="例: 14" value={targetDays} onChange={(e) => setTargetDays(e.target.value)} />
            <div className="flex items-end"><Button onClick={addItem}>追加</Button></div>
          </div>
        </CardBody>
      </Card>
    </AdminLayout>
  )
}
