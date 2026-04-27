'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, statusBadgeVariant } from '@/components/ui/badge'
import { Table } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface Submission {
  id: string
  file_name: string
  file_url: string
  status: string
  grade: number | null
  feedback: string | null
  submitted_at: string
  user: { id: string; name: string | null } | null
}

export default function SubmissionsPage() {
  const params = useParams()
  const assignmentId = params.assignmentId as string
  const supabase = useMemo(() => createClient(), [])

  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [assignmentTitle, setAssignmentTitle] = useState('')
  const [grading, setGrading] = useState<string | null>(null)
  const [gradeInput, setGradeInput] = useState('')
  const [feedbackInput, setFeedbackInput] = useState('')
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    const { data: assignment } = await supabase
      .from('assignments')
      .select('title')
      .eq('id', assignmentId)
      .single()

    if (assignment) setAssignmentTitle(assignment.title)

    const { data } = await supabase
      .from('assignment_submissions')
      .select('id, file_name, file_url, status, grade, feedback, submitted_at, user:profiles(id, name)')
      .eq('assignment_id', assignmentId)
      .order('submitted_at', { ascending: false })

    setSubmissions((data || []) as unknown as Submission[])
  }, [assignmentId, supabase])

  useEffect(() => { loadData() }, [loadData])

  const handleGrade = async (submissionId: string, status: string) => {
    setSaving(true)
    await fetch('/api/admin/assignments/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId,
        grade: gradeInput ? parseInt(gradeInput) : null,
        feedback: feedbackInput || null,
        status,
      }),
    })
    setSaving(false)
    setGrading(null)
    setGradeInput('')
    setFeedbackInput('')
    loadData()
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">提出一覧</h1>
      <p className="text-gray-500 mb-6">{assignmentTitle}</p>

      <Card>
        <CardBody className="p-0">
          <Table headers={['受講者', 'ファイル', 'ステータス', '評価', '提出日', '操作']}>
            {submissions.map((s) => (
              <tr key={s.id}>
                <td className="px-6 py-4 text-sm">{s.user?.name || '-'}</td>
                <td className="px-6 py-4 text-sm">
                  <a href={s.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {s.file_name}
                  </a>
                </td>
                <td className="px-6 py-4">
                  <Badge variant={statusBadgeVariant(s.status)}>{s.status}</Badge>
                </td>
                <td className="px-6 py-4 text-sm">{s.grade !== null ? `${s.grade}点` : '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(s.submitted_at).toLocaleDateString('ja-JP')}
                </td>
                <td className="px-6 py-4">
                  {grading === s.id ? (
                    <div className="space-y-2 min-w-[200px]">
                      <Input placeholder="評価（0-100）" value={gradeInput} onChange={(e) => setGradeInput(e.target.value)} type="number" />
                      <Textarea placeholder="フィードバック" value={feedbackInput} onChange={(e) => setFeedbackInput(e.target.value)} rows={2} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleGrade(s.id, 'approved')} loading={saving}>承認</Button>
                        <Button size="sm" variant="danger" onClick={() => handleGrade(s.id, 'rejected')} loading={saving}>差し戻し</Button>
                        <Button size="sm" variant="ghost" onClick={() => setGrading(null)}>閉じる</Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => { setGrading(s.id); setGradeInput(s.grade?.toString() || ''); setFeedbackInput(s.feedback || '') }}>
                      採点
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
