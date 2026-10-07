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
import { Badge } from '@/components/ui/badge'
import type { Course, Section, Lesson, Quiz, Assignment, CaseSimulation } from '@/lib/db'
import Link from 'next/link'

type SectionItem =
  | { type: 'lesson'; data: Lesson }
  | { type: 'quiz'; data: Quiz }
  | { type: 'assignment'; data: Assignment }
  | { type: 'case'; data: CaseSimulation }
type SectionWithItems = Section & { items: SectionItem[] }

export default function EditCoursePage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string
  const supabase = useMemo(() => createClient(), [])

  const [course, setCourse] = useState<Course | null>(null)
  const [sections, setSections] = useState<SectionWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
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

    const sectionsWithItems: SectionWithItems[] = await Promise.all(
      (sectionsData || []).map(async (section) => {
        const [lessonsRes, quizzesRes, assignmentsRes, casesRes] = await Promise.all([
          supabase.from('lessons').select('*').eq('section_id', section.id).order('sort_order'),
          supabase.from('quizzes').select('*').eq('section_id', section.id).order('sort_order'),
          supabase.from('assignments').select('*').eq('section_id', section.id).order('sort_order'),
          supabase.from('case_simulations').select('*').eq('section_id', section.id).order('sort_order'),
        ])

        const items: SectionItem[] = [
          ...(lessonsRes.data || []).map((l) => ({ type: 'lesson' as const, data: l as Lesson })),
          ...(quizzesRes.data || []).map((q) => ({ type: 'quiz' as const, data: q as Quiz })),
          ...(assignmentsRes.data || []).map((a) => ({ type: 'assignment' as const, data: a as Assignment })),
          ...(casesRes.data || []).map((c) => ({ type: 'case' as const, data: c as CaseSimulation })),
        ].sort((a, b) => a.data.sort_order - b.data.sort_order)

        return { ...section, items } as SectionWithItems
      })
    )

    setSections(sectionsWithItems)
    setLoading(false)
  }, [courseId, supabase])

  useEffect(() => { loadData() }, [loadData])

  const handleUpdateCourse = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const fd = new FormData(e.currentTarget)

    const { error: updateError } = await supabase.from('courses').update({
      title: fd.get('title') as string,
      description: fd.get('description') as string,
      thumbnail_url: (fd.get('thumbnail_url') as string) || null,
      status: fd.get('status') as string,
      is_sequential: fd.get('is_sequential') === 'true',
    }).eq('id', courseId)

    if (updateError) setError(updateError.message)
    setSaving(false)
  }

  const handleAddSection = async () => {
    if (!newSectionTitle.trim()) return
    const maxOrder = sections.reduce((max, s) => Math.max(max, s.sort_order), -1)
    const { error: insertError } = await supabase.from('sections').insert({
      course_id: courseId, title: newSectionTitle, sort_order: maxOrder + 1,
    })
    if (insertError) { setError(insertError.message); return }
    setNewSectionTitle('')
    loadData()
  }

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('このセクションを削除しますか？')) return
    await supabase.from('sections').delete().eq('id', sectionId)
    loadData()
  }

  const getMaxSortOrder = (sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId)
    return section ? section.items.reduce((max, item) => Math.max(max, item.data.sort_order), -1) : -1
  }

  const handleAddLesson = async (sectionId: string) => {
    const { data } = await supabase.from('lessons').insert({
      section_id: sectionId, title: '新しいレッスン', sort_order: getMaxSortOrder(sectionId) + 1,
    }).select().single()
    if (data) router.push(`/admin/lessons/${data.id}/edit`)
  }

  const handleAddQuiz = async (sectionId: string) => {
    const { data } = await supabase.from('quizzes').insert({
      section_id: sectionId, title: '新しいテスト', sort_order: getMaxSortOrder(sectionId) + 1,
    }).select().single()
    if (data) router.push(`/admin/quizzes/${data.id}/edit`)
  }

  const handleAddAssignment = async (sectionId: string) => {
    const { data } = await supabase.from('assignments').insert({
      section_id: sectionId, title: '新しい課題', sort_order: getMaxSortOrder(sectionId) + 1,
    }).select().single()
    if (data) router.push(`/admin/assignments/${data.id}/edit`)
  }

  const handleAddCase = async (sectionId: string) => {
    const { data } = await supabase.from('case_simulations').insert({
      section_id: sectionId, title: '新しい案件シミュレーター', sort_order: getMaxSortOrder(sectionId) + 1,
    }).select().single()
    if (data) router.push(`/admin/cases/${data.id}/edit`)
  }

  const typeLabel = (type: string) => {
    switch (type) {
      case 'lesson': return { text: 'レッスン', color: 'info' as const }
      case 'quiz': return { text: 'テスト', color: 'warning' as const }
      case 'assignment': return { text: '課題', color: 'default' as const }
      case 'case': return { text: '案件追体験', color: 'success' as const }
      default: return { text: type, color: 'default' as const }
    }
  }

  const editUrl = (item: SectionItem) => {
    switch (item.type) {
      case 'lesson': return `/admin/lessons/${item.data.id}/edit`
      case 'quiz': return `/admin/quizzes/${item.data.id}/edit`
      case 'assignment': return `/admin/assignments/${item.data.id}/edit`
      case 'case': return `/admin/cases/${item.data.id}/edit`
    }
  }

  if (loading) return <AdminLayout><p className="text-gray-500">読み込み中...</p></AdminLayout>
  if (!course) return <AdminLayout><p className="text-red-600">講座が見つかりません。</p></AdminLayout>

  return (
    <AdminLayout>
      <div className="mb-4">
        <Link href="/admin/courses" className="text-sm text-blue-600 hover:text-blue-700">&larr; 講座一覧に戻る</Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">講座を編集</h1>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">{error}</div>}

      <Card className="mb-8 max-w-2xl">
        <CardHeader><h2 className="text-lg font-semibold">基本情報</h2></CardHeader>
        <CardBody>
          <form onSubmit={handleUpdateCourse} className="space-y-4">
            <Input label="タイトル" name="title" required defaultValue={course.title} />
            <Textarea label="説明" name="description" defaultValue={course.description || ''} />
            <Input label="サムネイルURL" name="thumbnail_url" type="url" defaultValue={course.thumbnail_url || ''} />
            <Select label="ステータス" name="status" defaultValue={course.status} options={[
              { value: 'draft', label: '下書き' }, { value: 'published', label: '公開' }, { value: 'archived', label: 'アーカイブ' },
            ]} />
            <Select label="受講順序制御" name="is_sequential" defaultValue={course.is_sequential ? 'true' : 'false'} options={[
              { value: 'false', label: '自由（どのレッスンでも受講可）' },
              { value: 'true', label: '順序モード（前のレッスン/テストを完了しないと次に進めない）' },
            ]} />
            <Button type="submit" loading={saving}>保存</Button>
          </form>
        </CardBody>
      </Card>

      <h2 className="text-xl font-bold text-gray-900 mb-4">セクション & コンテンツ</h2>

      <div className="space-y-4 mb-6">
        {sections.map((section) => (
          <Card key={section.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{section.title}</h3>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => handleAddLesson(section.id)}>+ レッスン</Button>
                  <Button variant="secondary" size="sm" onClick={() => handleAddQuiz(section.id)}>+ テスト</Button>
                  <Button variant="secondary" size="sm" onClick={() => handleAddAssignment(section.id)}>+ 課題</Button>
                  <Button variant="secondary" size="sm" onClick={() => handleAddCase(section.id)}>+ 案件追体験</Button>
                  <Button variant="danger" size="sm" onClick={() => handleDeleteSection(section.id)}>削除</Button>
                </div>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {section.items.length === 0 ? (
                <p className="px-6 py-4 text-sm text-gray-500">コンテンツがありません。</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {section.items.map((item) => {
                    const label = typeLabel(item.type)
                    return (
                      <li key={`${item.type}-${item.data.id}`} className="flex items-center justify-between px-6 py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={label.color}>{label.text}</Badge>
                          <span className="text-sm font-medium text-gray-900">{item.data.title}</span>
                          <span className="text-xs text-gray-400">{item.data.status}</span>
                        </div>
                        <Link href={editUrl(item)}>
                          <Button variant="ghost" size="sm">編集</Button>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        ))}
      </div>

      <Card className="max-w-2xl">
        <CardBody>
          <div className="flex gap-3">
            <Input placeholder="新しいセクション名" value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)} />
            <Button onClick={handleAddSection} variant="secondary">セクション追加</Button>
          </div>
        </CardBody>
      </Card>
    </AdminLayout>
  )
}
