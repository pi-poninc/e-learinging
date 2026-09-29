'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { LessonAttachmentsAdmin } from '@/components/admin/lesson-attachments-admin'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { extractVimeoId } from '@/lib/vimeo'
import type { Lesson } from '@/lib/db'
import Link from 'next/link'

export default function EditLessonPage() {
  const router = useRouter()
  const params = useParams()
  const lessonId = params.lessonId as string
  const supabase = useMemo(() => createClient(), [])

  const [lesson, setLesson] = useState<(Lesson & { section: { course_id: string } }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetchingMeta, setFetchingMeta] = useState(false)
  const [error, setError] = useState('')

  const loadLesson = useCallback(async () => {
    const { data } = await supabase
      .from('lessons')
      .select('*, section:sections(course_id)')
      .eq('id', lessonId)
      .single()

    if (data) setLesson(data as Lesson & { section: { course_id: string } })
    setLoading(false)
  }, [lessonId, supabase])

  useEffect(() => {
    loadLesson()
  }, [loadLesson])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const vimeoUrl = formData.get('vimeo_url') as string

    const { error } = await supabase
      .from('lessons')
      .update({
        title: formData.get('title') as string,
        body: formData.get('body') as string || null,
        vimeo_url: vimeoUrl || null,
        vimeo_video_id: extractVimeoId(vimeoUrl) || null,
        duration_seconds: parseInt(formData.get('duration_seconds') as string) || null,
        sort_order: parseInt(formData.get('sort_order') as string) || 0,
        is_preview: formData.get('is_preview') === 'true',
        status: formData.get('status') as string,
      })
      .eq('id', lessonId)

    if (error) {
      setError(error.message)
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!confirm('このレッスンを削除しますか？')) return

    await supabase.from('lessons').delete().eq('id', lessonId)

    if (lesson?.section?.course_id) {
      router.push(`/admin/courses/${lesson.section.course_id}/edit`)
    } else {
      router.push('/admin/courses')
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <p className="text-gray-500">読み込み中...</p>
      </AdminLayout>
    )
  }

  if (!lesson) {
    return (
      <AdminLayout>
        <p className="text-red-600">レッスンが見つかりません。</p>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="mb-4">
        <Link
          href={`/admin/courses/${lesson.section.course_id}/edit`}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          &larr; 講座編集に戻る
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">レッスンを編集</h1>
        <Button variant="danger" size="sm" onClick={handleDelete}>
          削除
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {error}
        </div>
      )}

      <Card className="max-w-2xl">
        <CardHeader>
          <h2 className="text-lg font-semibold">レッスン情報</h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="タイトル"
              name="title"
              required
              defaultValue={lesson.title}
            />
            <Textarea
              label="本文"
              name="body"
              defaultValue={lesson.body || ''}
              rows={6}
              placeholder="レッスンの説明文やメモ"
            />
            <div>
              <Input
                label="Vimeo URL"
                name="vimeo_url"
                defaultValue={lesson.vimeo_url || ''}
                placeholder="https://vimeo.com/123456789"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={fetchingMeta}
                className="mt-1"
                onClick={async () => {
                  const form = document.querySelector('form') as HTMLFormElement
                  const url = new FormData(form).get('vimeo_url') as string
                  if (!url) { setError('Vimeo URLを入力してください'); return }
                  setFetchingMeta(true)
                  setError('')
                  try {
                    const res = await fetch(`/api/vimeo/meta?url=${encodeURIComponent(url)}`)
                    if (!res.ok) { const d = await res.json(); setError(d.error || 'メタデータ取得失敗'); setFetchingMeta(false); return }
                    const meta = await res.json()
                    const titleInput = form.querySelector('[name="title"]') as HTMLInputElement
                    const durationInput = form.querySelector('[name="duration_seconds"]') as HTMLInputElement
                    if (meta.name && titleInput) titleInput.value = meta.name
                    if (meta.duration && durationInput) durationInput.value = String(meta.duration)
                  } catch { setError('Vimeo APIエラー') }
                  setFetchingMeta(false)
                }}
              >
                Vimeoから情報を取得
              </Button>
            </div>
            <Input
              label="動画の長さ（秒）"
              name="duration_seconds"
              type="number"
              defaultValue={lesson.duration_seconds || ''}
            />
            <Input
              label="並び順"
              name="sort_order"
              type="number"
              defaultValue={lesson.sort_order}
            />
            <Select
              label="プレビュー公開"
              name="is_preview"
              defaultValue={lesson.is_preview ? 'true' : 'false'}
              options={[
                { value: 'false', label: 'いいえ' },
                { value: 'true', label: 'はい' },
              ]}
            />
            <Select
              label="ステータス"
              name="status"
              defaultValue={lesson.status}
              options={[
                { value: 'draft', label: '下書き' },
                { value: 'published', label: '公開' },
                { value: 'archived', label: 'アーカイブ' },
              ]}
            />
            <Button type="submit" loading={saving}>
              保存
            </Button>
          </form>
        </CardBody>
      </Card>

      <LessonAttachmentsAdmin lessonId={lessonId} />
    </AdminLayout>
  )
}
