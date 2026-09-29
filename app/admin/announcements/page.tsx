'use client'

import { useState, useEffect, useCallback } from 'react'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

interface Announcement {
  id: string; title: string; body: string
  group_id: string | null; groupLabel: string; created_at: string
}
interface Group { id: string; name: string }

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [groupId, setGroupId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [a, g] = await Promise.all([fetch('/api/admin/announcements'), fetch('/api/admin/groups')])
    if (a.ok) setItems((await a.json()).announcements || [])
    if (g.ok) setGroups((await g.json()).groups || [])
  }, [])
  useEffect(() => { load() }, [load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    setSaving(true); setError('')
    const res = await fetch('/api/admin/announcements', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, groupId: groupId || null }),
    })
    if (res.ok) { setTitle(''); setBody(''); setGroupId(''); await load() }
    else setError((await res.json()).error || '配信に失敗しました')
    setSaving(false)
  }

  const remove = async (id: string) => {
    if (!confirm('このお知らせを削除しますか？')) return
    const res = await fetch(`/api/admin/announcements?id=${id}`, { method: 'DELETE' })
    if (res.ok) await load()
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">お知らせ配信</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>新しいお知らせ</CardHeader>
          <CardBody>
            <form onSubmit={submit} className="space-y-3">
              <Input placeholder="タイトル" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea rows={5} placeholder="本文" value={body} onChange={(e) => setBody(e.target.value)} />
              <Select
                label="配信先"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                options={[{ value: '', label: '全員' }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" loading={saving} disabled={!title.trim() || !body.trim()}>配信する</Button>
            </form>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>配信済み（{items.length}）</CardHeader>
          <CardBody>
            {items.length === 0 ? (
              <p className="text-sm text-gray-500">まだお知らせがありません。</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {items.map((a) => (
                  <li key={a.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900">{a.title}</p>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap mt-1">{a.body}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          配信先: {a.groupLabel}・{(a.created_at || '').slice(0, 10)}
                        </p>
                      </div>
                      <button onClick={() => remove(a.id)} className="text-sm text-red-600 hover:underline shrink-0">削除</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </AdminLayout>
  )
}
