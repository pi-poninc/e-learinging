'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { LearningPath } from '@/lib/db'

export default function AdminPathsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [paths, setPaths] = useState<LearningPath[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('learning_paths').select('*').order('sort_order')
    setPaths((data || []) as LearningPath[])
    setLoading(false)
  }, [supabase])
  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!title.trim()) return
    const maxOrder = paths.reduce((m, p) => Math.max(m, p.sort_order), -1)
    const { data } = await supabase.from('learning_paths')
      .insert({ title, sort_order: maxOrder + 1 }).select().single()
    if (data) router.push(`/admin/paths/${data.id}/edit`)
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">学習ロードマップ</h1>

      <Card className="mb-6 max-w-2xl">
        <CardBody>
          <div className="flex gap-3">
            <Input placeholder="新しいロードマップ名（例: FDE養成コース）" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Button onClick={create} variant="secondary">作成</Button>
          </div>
        </CardBody>
      </Card>

      {loading ? <p className="text-gray-500">読み込み中...</p> : (
        <div className="space-y-3 max-w-3xl">
          {paths.length === 0 && <p className="text-gray-500 text-sm">まだありません。</p>}
          {paths.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{p.title}</span>
                    <Badge variant={p.status === 'published' ? 'success' : 'default'}>{p.status}</Badge>
                  </div>
                  <Link href={`/admin/paths/${p.id}/edit`}><Button variant="ghost" size="sm">編集</Button></Link>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
