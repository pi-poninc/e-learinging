import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/permissions'
import { StudentLayout } from '@/components/layouts/student-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge, statusBadgeVariant } from '@/components/ui/badge'
import { FileUpload } from '@/components/file-upload'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

interface Props {
  params: Promise<{ assignmentId: string }>
}

export default async function AssignmentPage({ params }: Props) {
  const { assignmentId } = await params
  const profile = await requireAuth()
  const supabase = await createClient()
  const admin = isAdmin(profile.role)

  const { data: assignment } = await supabase
    .from('assignments')
    .select('*, section:sections(id, title, course_id, course:courses(id, title))')
    .eq('id', assignmentId)
    .single()

  if (!assignment) notFound()

  const section = assignment.section as unknown as {
    id: string; title: string; course_id: string
    course: { id: string; title: string }
  }

  if (!admin && assignment.status !== 'published') notFound()

  if (!admin) {
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', profile.id)
      .eq('course_id', section.course_id)
      .eq('status', 'active')
      .single()

    if (!enrollment) redirect('/dashboard')
  }

  // Get existing submission
  const { data: submission } = await supabase
    .from('assignment_submissions')
    .select('*')
    .eq('user_id', profile.id)
    .eq('assignment_id', assignmentId)
    .maybeSingle()

  return (
    <StudentLayout isAdmin={admin}>
      <div className="mb-4">
        <Link href={`/courses/${section.course_id}`} className="text-sm text-blue-600 hover:text-blue-700">
          &larr; {section.course.title} に戻る
        </Link>
      </div>

      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{assignment.title}</h1>
        <p className="text-sm text-gray-500 mb-6">{section.title}</p>

        {assignment.description && (
          <Card className="mb-6">
            <CardBody>
              <div className="prose max-w-none text-sm">
                <div dangerouslySetInnerHTML={{ __html: assignment.description.replace(/\n/g, '<br>') }} />
              </div>
            </CardBody>
          </Card>
        )}

        {/* Existing submission */}
        {submission && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">提出済み</h2>
                <Badge variant={statusBadgeVariant(submission.status)}>
                  {submission.status === 'submitted' ? '提出済み' :
                   submission.status === 'approved' ? '承認' :
                   submission.status === 'rejected' ? '差し戻し' : '確認中'}
                </Badge>
              </div>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-gray-600">ファイル: {submission.file_name}</p>
              <p className="text-sm text-gray-500 mt-1">
                提出日: {new Date(submission.submitted_at).toLocaleString('ja-JP')}
              </p>
              {submission.grade !== null && (
                <p className="text-sm font-medium mt-2">評価: {submission.grade}点</p>
              )}
              {submission.feedback && (
                <div className="mt-2 p-3 bg-gray-50 rounded text-sm text-gray-700">
                  <p className="font-medium mb-1">フィードバック:</p>
                  {submission.feedback}
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {/* Upload form (show if not approved) */}
        {(!submission || submission.status !== 'approved') && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">
                {submission ? 'ファイルを再提出' : 'ファイルを提出'}
              </h2>
            </CardHeader>
            <CardBody>
              <FileUpload
                assignmentId={assignmentId}
                allowedTypes={assignment.allowed_file_types as string[]}
                maxSizeMb={assignment.max_file_size_mb}
                onUploaded={() => window.location.reload()}
              />
            </CardBody>
          </Card>
        )}
      </div>
    </StudentLayout>
  )
}
