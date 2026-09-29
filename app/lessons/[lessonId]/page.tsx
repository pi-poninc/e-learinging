import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/permissions'
import { StudentLayout } from '@/components/layouts/student-layout'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { VimeoPlayerWrapper } from '@/components/vimeo-player'
import { LessonNotes } from '@/components/lesson-notes'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

interface Props {
  params: Promise<{ lessonId: string }>
}

export default async function LessonPage({ params }: Props) {
  const { lessonId } = await params
  const profile = await requireAuth()
  const supabase = await createClient()
  const admin = isAdmin(profile.role)

  // Get lesson with section and course info
  const { data: lesson } = await supabase
    .from('lessons')
    .select(`
      *,
      section:sections (
        id,
        title,
        course_id,
        course:courses (
          id,
          title
        )
      )
    `)
    .eq('id', lessonId)
    .single()

  if (!lesson) notFound()

  const section = lesson.section as unknown as {
    id: string
    title: string
    course_id: string
    course: { id: string; title: string }
  }

  // Students can only see published lessons
  if (!admin && lesson.status !== 'published') notFound()

  // Check enrollment for students
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

  // Get existing progress
  const { data: progress } = await supabase
    .from('lesson_progress')
    .select('*')
    .eq('user_id', profile.id)
    .eq('lesson_id', lessonId)
    .single()

  // Get next lesson
  const { data: allLessons } = await supabase
    .from('lessons')
    .select('id, sort_order, section:sections!inner(sort_order, course_id)')
    .eq('sections.course_id', section.course_id)
    .eq('status', 'published')
    .order('sort_order')

  let nextLessonId: string | null = null
  if (allLessons) {
    const currentIndex = allLessons.findIndex((l) => l.id === lessonId)
    if (currentIndex >= 0 && currentIndex < allLessons.length - 1) {
      nextLessonId = allLessons[currentIndex + 1].id
    }
  }

  // 配布ファイル
  const { data: attachments } = await supabase
    .from('lesson_attachments')
    .select('id, file_name, file_url, size_bytes, preview_text, zip_entries')
    .eq('lesson_id', lesson.id)
    .order('created_at')

  const fmtSize = (b: number) =>
    b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)}MB` : b >= 1024 ? `${Math.round(b / 1024)}KB` : `${b}B`

  return (
    <StudentLayout isAdmin={admin}>
      <div className="mb-4">
        <Link
          href={`/courses/${section.course_id}`}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          &larr; {section.course.title} に戻る
        </Link>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-1">{section.title}</p>
          <h1 className="text-2xl font-bold text-gray-900">{lesson.title}</h1>
          {lesson.status === 'draft' && admin && (
            <Badge variant="warning">下書き</Badge>
          )}
        </div>

        {/* Vimeo Player */}
        {lesson.vimeo_url || lesson.vimeo_video_id ? (
          <div className="mb-6">
            <VimeoPlayerWrapper
              lessonId={lesson.id}
              vimeoUrl={lesson.vimeo_url || ''}
              vimeoVideoId={lesson.vimeo_video_id || ''}
              initialWatchedSeconds={progress?.watched_seconds || 0}
              initialProgressRate={progress?.progress_rate ? Number(progress.progress_rate) : 0}
            />
          </div>
        ) : (
          <Card className="mb-6">
            <CardBody>
              <p className="text-gray-500 text-center py-12">動画が設定されていません。</p>
            </CardBody>
          </Card>
        )}

        {/* Lesson body */}
        {lesson.body && (
          <Card className="mb-6">
            <CardBody>
              <div className="prose max-w-none">
                <div dangerouslySetInnerHTML={{ __html: lesson.body.replace(/\n/g, '<br>') }} />
              </div>
            </CardBody>
          </Card>
        )}

        {/* 配布ファイル（ダウンロード＋中身プレビュー） */}
        {attachments && attachments.length > 0 && (
          <Card className="mb-6">
            <CardBody>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">配布ファイル</h2>
              <ul className="space-y-4">
                {attachments.map((a) => {
                  const entries = (a.zip_entries as string[] | null) || null
                  const preview = a.preview_text as string | null
                  return (
                    <li key={a.id} className="border border-gray-100 rounded-md p-3">
                      <a
                        href={a.file_url}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-blue-600 hover:underline break-all font-medium"
                      >
                        <span aria-hidden>⬇︎</span>
                        {a.file_name}
                        <span className="text-xs text-gray-400">{fmtSize(a.size_bytes)}</span>
                      </a>

                      {/* zip: 含まれるファイル一覧 */}
                      {entries && entries.length > 0 && (
                        <div className="mt-2 text-sm text-gray-600">
                          <p className="text-xs text-gray-500 mb-1">含まれるファイル（{entries.length}）</p>
                          <ul className="pl-4 list-disc space-y-0.5">
                            {entries.map((e, i) => (
                              <li key={i} className="break-all font-mono text-xs text-gray-600">{e}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* テキスト/案内: 本文プレビュー（開閉） */}
                      {preview && (
                        <details className="mt-2">
                          <summary className="text-sm text-blue-600 cursor-pointer select-none">中身を確認する</summary>
                          <pre className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-700 bg-gray-50 rounded-md p-3 max-h-80 overflow-auto">
                            {preview}
                          </pre>
                        </details>
                      )}
                    </li>
                  )
                })}
              </ul>
            </CardBody>
          </Card>
        )}

        {/* 学びメモ */}
        <LessonNotes lessonId={lesson.id} />

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Link
            href={`/courses/${section.course_id}`}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            &larr; コース一覧
          </Link>
          {nextLessonId && (
            <Link
              href={`/lessons/${nextLessonId}`}
              className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              次のレッスンへ &rarr;
            </Link>
          )}
        </div>
      </div>
    </StudentLayout>
  )
}
