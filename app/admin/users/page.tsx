'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge, statusBadgeVariant } from '@/components/ui/badge'
import { Table } from '@/components/ui/table'

interface UserRow {
  id: string
  name: string | null
  role: string
  group_id: string | null
  created_at: string
}

export default function AdminUsersPage() {
  const supabase = useMemo(() => createClient(), [])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // New user form
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('student')
  const [creating, setCreating] = useState(false)

  // Edit role / group
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState('')
  const [editGroupId, setEditGroupId] = useState('')
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])

  const loadUsers = useCallback(async () => {
    const [{ data }, gRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, name, role, group_id, created_at')
        .order('created_at', { ascending: false }),
      fetch('/api/admin/groups'),
    ])
    setUsers((data || []) as UserRow[])
    if (gRes.ok) setGroups((await gRes.json()).groups || [])
  }, [supabase])

  useEffect(() => { loadUsers() }, [loadUsers])

  const groupName = (id: string | null) => (id ? (groups.find((g) => g.id === id)?.name || '—') : '未所属')

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setCreating(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, role }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'ユーザー作成に失敗しました')
        setCreating(false)
        return
      }

      setSuccess(`${email} を ${role} として作成しました`)
      setEmail('')
      setName('')
      setPassword('')
      setRole('student')
      loadUsers()
    } catch {
      setError('ネットワークエラーが発生しました')
    }
    setCreating(false)
  }

  const handleUpdateRole = async (userId: string) => {
    setLoading(true)
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: editRole, groupId: editGroupId || null }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'ロール更新に失敗しました')
    } else {
      setEditingId(null)
      loadUsers()
    }
    setLoading(false)
  }

  const roleVariant = (r: string) => {
    if (r === 'admin') return 'danger' as const
    if (r === 'instructor') return 'warning' as const
    return 'info' as const
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">ユーザー管理</h1>

      {/* Create user */}
      <Card className="mb-8">
        <CardHeader>
          <h2 className="text-lg font-semibold">新規ユーザー作成</h2>
        </CardHeader>
        <CardBody>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">{error}</div>}
          {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-600">{success}</div>}

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="メールアドレス"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="user@example.com"
              />
              <Input
                label="パスワード"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="6文字以上"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="名前"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="山田 太郎"
              />
              <Select
                label="ロール"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                options={[
                  { value: 'student', label: '受講者 (student)' },
                  { value: 'manager', label: '部署マネージャー (manager)' },
                  { value: 'instructor', label: '講師 (instructor)' },
                  { value: 'admin', label: '管理者 (admin)' },
                ]}
              />
            </div>
            <Button type="submit" loading={creating}>ユーザーを作成</Button>
          </form>
        </CardBody>
      </Card>

      {/* Users list */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">ユーザー一覧</h2>
        </CardHeader>
        <CardBody className="p-0">
          <Table headers={['名前', 'ロール', 'グループ', '作成日', '操作']}>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 text-sm text-gray-900">{user.name || user.id.slice(0, 8)}</td>
                <td className="px-6 py-4">
                  <Badge variant={roleVariant(user.role)}>{user.role}</Badge>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{groupName(user.group_id)}</td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(user.created_at).toLocaleDateString('ja-JP')}
                </td>
                <td className="px-6 py-4">
                  {editingId === user.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                      >
                        <option value="student">student</option>
                        <option value="manager">manager</option>
                        <option value="instructor">instructor</option>
                        <option value="admin">admin</option>
                      </select>
                      <select
                        value={editGroupId}
                        onChange={(e) => setEditGroupId(e.target.value)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                      >
                        <option value="">未所属</option>
                        {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                      <Button size="sm" onClick={() => handleUpdateRole(user.id)} loading={loading}>保存</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>取消</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => { setEditingId(user.id); setEditRole(user.role); setEditGroupId(user.group_id || '') }}>
                      変更
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </CardBody>
      </Card>
    </AdminLayout>
  )
}
