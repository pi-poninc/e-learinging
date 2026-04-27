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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    const [enrollRes, usersRes, coursesRes] = await Promise.all([
      supabase
        .from('enrollments')
        .select('id, status, enrolled_at, user:profiles(id, name), course:courses(id, title)')
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
      body: JSON.stringify({ userId: selectedUser, courseId: selectedCourse }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'エラーが発生しました')
    } else {
      setSelectedUser('')
      setSelectedCourse('')
      loadData()
    }
    setLoading(false)
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">受講者管理</h1>

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
          <Table headers={['ユーザー', '講座', 'ステータス', '登録日']}>
            {enrollments.map((enrollment) => (
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
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(enrollment.enrolled_at).toLocaleDateString('ja-JP')}
                </td>
              </tr>
            ))}
          </Table>
        </CardBody>
      </Card>
    </AdminLayout>
  )
}
