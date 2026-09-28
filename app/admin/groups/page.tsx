'use client'

import { useState, useEffect, useCallback } from 'react'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table } from '@/components/ui/table'

interface Group {
  id: string
  name: string
  description: string | null
  memberCount: number
  created_at: string
}

export default function AdminGroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/groups')
    if (res.ok) setGroups((await res.json()).groups || [])
  }, [])

  useEffect(() => { load() }, [load])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true); setError('')
    const res = await fetch('/api/admin/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    })
    if (res.ok) {
      setName(''); setDescription(''); await load()
    } else {
      setError((await res.json()).error || '作成に失敗しました')
    }
    setCreating(false)
  }

  const remove = async (g: Group) => {
    if (!confirm(`グループ「${g.name}」を削除しますか？（所属者は未所属に戻ります）`)) return
    const res = await fetch(`/api/admin/groups?id=${g.id}`, { method: 'DELETE' })
    if (res.ok) await load()
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">グループ管理</h1>
        <a href="/admin/users/import" className="text-sm text-blue-600 hover:underline">
          受講者を一括登録（CSV） →
        </a>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>新しいグループ</CardHeader>
          <CardBody>
            <form onSubmit={create} className="space-y-3">
              <Input placeholder="グループ名（例：営業部）" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="説明（任意）" value={description} onChange={(e) => setDescription(e.target.value)} />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" loading={creating} disabled={!name.trim()}>作成</Button>
            </form>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>グループ一覧（{groups.length}）</CardHeader>
          <CardBody>
            {groups.length === 0 ? (
              <p className="text-sm text-gray-500">まだグループがありません。</p>
            ) : (
              <Table headers={['グループ名', '説明', '所属人数', '']}>
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td className="px-6 py-4 font-medium text-gray-900">{g.name}</td>
                    <td className="px-6 py-4 text-gray-500">{g.description || '—'}</td>
                    <td className="px-6 py-4">{g.memberCount} 人</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => remove(g)} className="text-sm text-red-600 hover:underline">削除</button>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </AdminLayout>
  )
}
