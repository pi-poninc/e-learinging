'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function EditAssignmentPage() {
  const router = useRouter()
  const params = useParams()
  const assignmentId = params.assignmentId as string
  const supabase = useMemo(() => createClient(), [])

  const [assignment, setAssignment] = useState<{ section: { course_id: string } } & Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from('assignments')
      .select('*, section:sections(course_id)')
      .eq('id', assignmentId)
      .single()
    if (data) setAssignment(data as typeof assignment)
    setLoading(false)
  }, [assignmentId, supabase])

  useEffect(() => { loadData() }, [loadData])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const fd = new FormData(e.currentTarget)

    const { error: err } = await supabase.from('assignments').update({
      title: fd.get('title') as string,
      description: (fd.get('description') as string) || null,
      sort_order: parseInt(fd.get('sort_order') as string) || 0,
      max_file_size_mb: parseInt(fd.get('max_file_size_mb') as string) || 10,
      allowed_file_types: (fd.get('allowed_file_types') as string).split(',').map((t) => t.trim()).filter(Boolean),
      status: fd.get('status') as string,
    }).eq('id', assignmentId)

    if (err) setError(err.message)
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!confirm('この課題を削除しますか？')) return
    await supabase.from('assignments').delete().eq('id', assignmentId)
    if (assignment?.section?.course_id) {
      router.push(`/admin/courses/${assignment.section.course_id}/edit`)
    } else {
      router.push('/admin/courses')
    }
  }

  if (loading) return <AdminLayout><p className="text-gray-500">読み込み中...</p></AdminLayout>
  if (!assignment) return <AdminLayout><p className="text-red-600">課題が見つかりません。</p></AdminLayout>

  return (
    <AdminLayout>
      <div className="mb-4">
        <Link href={`/admin/courses/${assignment.section.course_id}/edit`} className="text-sm text-blue-600 hover:text-blue-700">
          &larr; 講座編集に戻る
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">課題を編集</h1>
        <Button variant="danger" size="sm" onClick={handleDelete}>削除</Button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">{error}</div>}

      <Card className="max-w-2xl">
        <CardHeader><h2 className="text-lg font-semibold">課題情報</h2></CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="タイトル" name="title" required defaultValue={assignment.title as string} />
            <Textarea label="説明" name="description" defaultValue={(assignment.description as string) || ''} rows={6} />
            <Input label="並び順" name="sort_order" type="number" defaultValue={assignment.sort_order as number} />
            <Input label="最大ファイルサイズ(MB)" name="max_file_size_mb" type="number" defaultValue={assignment.max_file_size_mb as number} />
            <Input label="許可するファイル形式（カンマ区切り）" name="allowed_file_types" defaultValue={(assignment.allowed_file_types as string[]).join(', ')} placeholder="pdf, doc, docx, ppt, zip" />
            <Select label="ステータス" name="status" defaultValue={assignment.status as string} options={[
              { value: 'draft', label: '下書き' }, { value: 'published', label: '公開' }, { value: 'archived', label: 'アーカイブ' },
            ]} />
            <Button type="submit" loading={saving}>保存</Button>
          </form>
        </CardBody>
      </Card>
    </AdminLayout>
  )
}
