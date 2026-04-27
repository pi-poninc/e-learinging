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
import type { Course, Section, Lesson } from '@/lib/db'
import Link from 'next/link'

export default function EditCoursePage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string
  const supabase = useMemo(() => createClient(), [])

  const [course, setCourse] = useState<Course | null>(null)
  const [sections, setSections] = useState<(Section & { lessons: Lesson[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // New section form
  const [newSectionTitle, setNewSectionTitle] = useState('')

  const loadData = useCallback(async () => {
    const { data: courseData } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single()

    if (courseData) setCourse(courseData as Course)

    const { data: sectionsData } = await supabase
      .from('sections')
      .select('*')
      .eq('course_id', courseId)
      .order('sort_order')

    const sectionsWithLessons = await Promise.all(
      (sectionsData || []).map(async (section) => {
        const { data: lessons } = await supabase
          .from('lessons')
          .select('*')
          .eq('section_id', section.id)
          .order('sort_order')
        return { ...section, lessons: lessons || [] } as Section & { lessons: Lesson[] }
      })
    )

    setSections(sectionsWithLessons)
    setLoading(false)
  }, [courseId, supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleUpdateCourse = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const formData = new FormData(e.currentTarget)

    const { error: updateError } = await supabase
      .from('courses')
      .update({
        title: formData.get('title') as string,
        description: formData.get('description') as string,
        thumbnail_url: (formData.get('thumbnail_url') as string) || null,
        status: formData.get('status') as string,
      })
      .eq('id', courseId)

    if (updateError) {
      setError(updateError.message)
    }
    setSaving(false)
  }

  const handleAddSection = async () => {
    if (!newSectionTitle.trim()) return

    const maxOrder = sections.reduce((max, s) => Math.max(max, s.sort_order), -1)

    const { error: insertError } = await supabase.from('sections').insert({
      course_id: courseId,
      title: newSectionTitle,
      sort_order: maxOrder + 1,
    })

    if (insertError) {
      setError(insertError.message)
      return
    }

    setNewSectionTitle('')
    loadData()
  }

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('このセクションを削除しますか？関連するレッスンも削除されます。')) return

    const { error: deleteError } = await supabase.from('sections').delete().eq('id', sectionId)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    loadData()
  }

  const handleAddLesson = async (sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId)
    const maxOrder = section
      ? section.lessons.reduce((max, l) => Math.max(max, l.sort_order), -1)
      : -1

    const { data } = await supabase
      .from('lessons')
      .insert({
        section_id: sectionId,
        title: '新しいレッスン',
        sort_order: maxOrder + 1,
      })
      .select()
      .single()

    if (data) {
      router.push(`/admin/lessons/${data.id}/edit`)
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <p className="text-gray-500">読み込み中...</p>
      </AdminLayout>
    )
  }

  if (!course) {
    return (
      <AdminLayout>
        <p className="text-red-600">講座が見つかりません。</p>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="mb-4">
        <Link href="/admin/courses" className="text-sm text-blue-600 hover:text-blue-700">
          &larr; 講座一覧に戻る
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">講座を編集</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Course info */}
      <Card className="mb-8 max-w-2xl">
        <CardHeader>
          <h2 className="text-lg font-semibold">基本情報</h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleUpdateCourse} className="space-y-4">
            <Input
              label="タイトル"
              name="title"
              required
              defaultValue={course.title}
            />
            <Textarea
              label="説明"
              name="description"
              defaultValue={course.description || ''}
            />
            <Input
              label="サムネイルURL"
              name="thumbnail_url"
              type="url"
              defaultValue={course.thumbnail_url || ''}
            />
            <Select
              label="ステータス"
              name="status"
              defaultValue={course.status}
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

      {/* Sections & Lessons */}
      <h2 className="text-xl font-bold text-gray-900 mb-4">セクション & レッスン</h2>

      <div className="space-y-4 mb-6">
        {sections.map((section) => (
          <Card key={section.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{section.title}</h3>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAddLesson(section.id)}
                  >
                    レッスン追加
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteSection(section.id)}
                  >
                    削除
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {section.lessons.length === 0 ? (
                <p className="px-6 py-4 text-sm text-gray-500">レッスンがありません。</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {section.lessons.map((lesson) => (
                    <li
                      key={lesson.id}
                      className="flex items-center justify-between px-6 py-3"
                    >
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          {lesson.title}
                        </span>
                        <span className="ml-2 text-xs text-gray-400">
                          {lesson.status}
                        </span>
                      </div>
                      <Link href={`/admin/lessons/${lesson.id}/edit`}>
                        <Button variant="ghost" size="sm">
                          編集
                        </Button>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Add section */}
      <Card className="max-w-2xl">
        <CardBody>
          <div className="flex gap-3">
            <Input
              placeholder="新しいセクション名"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
            />
            <Button onClick={handleAddSection} variant="secondary">
              セクション追加
            </Button>
          </div>
        </CardBody>
      </Card>
    </AdminLayout>
  )
}
