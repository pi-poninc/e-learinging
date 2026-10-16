'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, statusBadgeVariant } from '@/components/ui/badge'
import { Table } from '@/components/ui/table'

interface ProfileOption {
  id: string
  name: string | null
  role: string
}

interface CourseOption {
  id: string
  title: string
}

interface EnrollmentRow {
  id: string
  status: string
  enrolled_at: string
  due_date: string | null
  user: { id: string; name: string | null } | null
  course: { id: string; title: string } | null
}

export default function AdminEnrollmentsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [users, setUsers] = useState<ProfileOption[]>([])
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedCourse, setSelectedCourse] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // 全講座一括登録
  const [bulkUser, setBulkUser] = useState('')
  const [bulkDue, setBulkDue] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkMsg, setBulkMsg] = useState('')

  const loadData = useCallback(async () => {
    const [enrollRes, usersRes, coursesRes] = await Promise.all([
      supabase
        .from('enrollments')
        .select('id, status, enrolled_at, due_date, user:profiles(id, name), course:courses(id, title)')
        .order('enrolled_at', { ascending: false }),
      supabase.from('profiles').select('id, name, role').eq('role', 'student'),
      supabase.from('courses').select('id, title').order('title'),
    ])

    setEnrollments((enrollRes.data || []) as unknown as EnrollmentRow[])
    setUsers(usersRes.data || [])
    setCourses(coursesRes.data || [])
  }, [supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreate = async () => {
    if (!selectedUser || !selectedCourse) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/admin/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: selectedUser, courseId: selectedCourse, dueDate: dueDate || null }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'エラーが発生しました')
    } else {
      setSelectedUser('')
      setSelectedCourse('')
      setDueDate('')
      loadData()
    }
    setLoading(false)
  }

  const handleBulkEnroll = async () => {
    if (!bulkUser) return
    setBulkLoading(true)
    setBulkMsg('')
    setError('')
    const res = await fetch('/api/admin/enrollments/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: bulkUser, dueDate: bulkDue || null }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'エラーが発生しました')
    } else {
      const name = users.find((u) => u.id === bulkUser)?.name || bulkUser
      setBulkMsg(`${name} さんを公開中の全 ${data.total} 講座に登録しました。`)
      setBulkUser('')
      setBulkDue('')
      loadData()
    }
    setBulkLoading(false)
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">受講者管理</h1>

      {/* Bulk enroll into all courses */}
      <Card className="mb-8 border-blue-200">
        <CardHeader>
          <h2 className="text-lg font-semibold">全講座に一括登録</h2>
          <p className="text-sm text-gray-500 mt-1">選んだユーザーを、公開中のすべての講座に一度に登録します（既存の受講はそのまま）。</p>
        </CardHeader>
        <CardBody>
          {bulkMsg && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
              {bulkMsg}
            </div>
          )}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-full sm:w-auto sm:flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">ユーザー</label>
              <select
                value={bulkUser}
                onChange={(e) => setBulkUser(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">選択してください</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name || u.id}</option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-auto">
              <label className="block text-sm font-medium text-gray-700 mb-1">受講期限（任意・全講座共通）</label>
              <input
                type="date"
                value={bulkDue}
                onChange={(e) => setBulkDue(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <Button onClick={handleBulkEnroll} loading={bulkLoading} disabled={!bulkUser}>
              全講座に登録
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Create enrollment */}
      <Card className="mb-8">
        <CardHeader>
          <h2 className="text-lg font-semibold">受講登録を追加</h2>
        </CardHeader>
        <CardBody>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
              {error}
            </div>
          )}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-full sm:w-auto sm:flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">ユーザー</label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">選択してください</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-auto sm:flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">講座</label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">選択してください</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-auto">
              <label className="block text-sm font-medium text-gray-700 mb-1">受講期限（任意）</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <Button onClick={handleCreate} loading={loading}>
              登録
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Enrollments list */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">受講登録一覧</h2>
        </CardHeader>
        <CardBody className="p-0">
          <Table headers={['ユーザー', '講座', 'ステータス', '受講期限', '登録日']}>
            {enrollments.map((enrollment) => {
              const overdue =
                enrollment.due_date &&
                enrollment.status !== 'completed' &&
                new Date(enrollment.due_date) < new Date(new Date().toDateString())
              return (
                <tr key={enrollment.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {enrollment.user?.name || enrollment.user?.id || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {enrollment.course?.title || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={statusBadgeVariant(enrollment.status)}>
                      {enrollment.status}
                    </Badge>
                  </td>
                  <td className={`px-6 py-4 text-sm ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                    {enrollment.due_date
                      ? `${new Date(enrollment.due_date).toLocaleDateString('ja-JP')}${overdue ? '（期限切れ）' : ''}`
                      : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(enrollment.enrolled_at).toLocaleDateString('ja-JP')}
                  </td>
                </tr>
              )
            })}
          </Table>
        </CardBody>
      </Card>
    </AdminLayout>
  )
}
