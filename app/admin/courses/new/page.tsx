'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

export default function NewCoursePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.from('courses').insert({
        title: formData.get('title') as string,
        description: formData.get('description') as string,
        thumbnail_url: formData.get('thumbnail_url') as string || null,
        status: formData.get('status') as string,
        created_by: user.id,
      })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      router.push('/admin/courses')
      router.refresh()
    } catch {
      setError('ネットワークエラーが発生しました。')
      setLoading(false)
    }
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">講座を作成</h1>

      <Card className="max-w-2xl">
        <CardHeader>
          <h2 className="text-lg font-semibold">基本情報</h2>
        </CardHeader>
        <CardBody>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="タイトル"
              name="title"
              required
              placeholder="講座のタイトル"
            />
            <Textarea
              label="説明"
              name="description"
              placeholder="講座の説明文"
            />
            <Input
              label="サムネイルURL"
              name="thumbnail_url"
              type="url"
              placeholder="https://..."
            />
            <Select
              label="ステータス"
              name="status"
              options={[
                { value: 'draft', label: '下書き' },
                { value: 'published', label: '公開' },
                { value: 'archived', label: 'アーカイブ' },
              ]}
            />
            <div className="flex gap-3">
              <Button type="submit" loading={loading}>
                作成
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push('/admin/courses')}
              >
                キャンセル
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </AdminLayout>
  )
}
