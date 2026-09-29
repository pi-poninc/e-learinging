'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Attachment {
  id: string
  file_name: string
  file_url: string
  size_bytes: number
}

function fmtSize(b: number) {
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)}MB`
  if (b >= 1024) return `${Math.round(b / 1024)}KB`
  return `${b}B`
}

export function LessonAttachmentsAdmin({ lessonId }: { lessonId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [items, setItems] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('lesson_attachments')
      .select('id, file_name, file_url, size_bytes')
      .eq('lesson_id', lessonId)
      .order('created_at')
    setItems((data || []) as Attachment[])
  }, [supabase, lessonId])

  useEffect(() => { load() }, [load])

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setError('')
    const form = new FormData()
    form.append('lessonId', lessonId)
    form.append('file', file)
    const res = await fetch('/api/admin/lessons/attachments', { method: 'POST', body: form })
    if (res.ok) await load()
    else setError((await res.json()).error || 'アップロードに失敗しました')
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const remove = async (id: string) => {
    if (!confirm('この配布ファイルを削除しますか？')) return
    const res = await fetch(`/api/admin/lessons/attachments?id=${id}`, { method: 'DELETE' })
    if (res.ok) await load()
  }

  return (
    <Card className="max-w-2xl mt-6">
      <CardHeader>配布ファイル（実演・演習用）</CardHeader>
      <CardBody>
        <p className="text-sm text-gray-500 mb-3">
          受講者がレッスンページからダウンロードできる資料を添付します（1ファイル最大50MB）。
        </p>

        {items.length > 0 && (
          <ul className="divide-y divide-gray-100 mb-4">
            {items.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <a href={a.file_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">
                    {a.file_name}
                  </a>
                  <span className="text-xs text-gray-400 ml-2">{fmtSize(a.size_bytes)}</span>
                </div>
                <button onClick={() => remove(a.id)} className="text-sm text-red-600 hover:underline shrink-0 ml-3">削除</button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        <input ref={inputRef} type="file" onChange={onUpload} className="hidden" />
        <Button variant="secondary" size="sm" loading={uploading} onClick={() => inputRef.current?.click()}>
          ファイルを追加
        </Button>
      </CardBody>
    </Card>
  )
}
