'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StudentLayout } from '@/components/layouts/student-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Submission {
  id: string
  title: string
  body: string
  reference_url: string | null
  status: string
  created_at: string
}

const STATUS_LABEL: Record<string, { label: string; variant: 'info' | 'warning' | 'success' | 'danger' }> = {
  new: { label: '未対応', variant: 'info' },
  in_progress: { label: '制作中', variant: 'warning' },
  done: { label: '公開済み', variant: 'success' },
  rejected: { label: '見送り', variant: 'danger' },
}

export default function SubmitPage() {
  const supabase = useMemo(() => createClient(), [])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [refUrl, setRefUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [mine, setMine] = useState<Submission[]>([])

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('content_submissions')
      .select('id, title, body, reference_url, status, created_at')
      .order('created_at', { ascending: false })
    setMine((data || []) as Submission[])
  }, [supabase])
  useEffect(() => { load() }, [load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    setSaving(true); setError(''); setDone(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('ログインが必要です'); setSaving(false); return }
    const { error: err } = await supabase.from('content_submissions').insert({
      user_id: user.id, title: title.trim(), body: body.trim(), reference_url: refUrl.trim() || null,
    })
    if (err) setError(err.message)
    else { setTitle(''); setBody(''); setRefUrl(''); setDone(true); await load() }
    setSaving(false)
  }

  return (
    <StudentLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">ネタ投稿</h1>
      <p className="text-sm text-gray-500 mb-6">
        仕事で「これ教育コンテンツになりそう」と思ったネタ・メモを投げてください。動画講座の元になります。きれいに書かなくてOKです。
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>新しいネタを投稿</CardHeader>
          <CardBody>
            <form onSubmit={submit} className="space-y-3">
              <Input label="タイトル" placeholder="例：顧客ヒアリングで効いた質問の型" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea label="ネタ・メモ（数行でOK）" rows={8}
                placeholder="今日の気づき、うまくいったやり方、新人に伝えたいこと…" value={body} onChange={(e) => setBody(e.target.value)} />
              <Input label="参考リンク（任意）" placeholder="Google Docs / Slack など" value={refUrl} onChange={(e) => setRefUrl(e.target.value)} />
              {error && <p className="text-sm text-red-600">{error}</p>}
              {done && <p className="text-sm text-green-600">投稿しました！ありがとうございます。</p>}
              <Button type="submit" loading={saving} disabled={!title.trim() || !body.trim()}>投稿する</Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>あなたの投稿（{mine.length}）</CardHeader>
          <CardBody>
            {mine.length === 0 ? (
              <p className="text-sm text-gray-500">まだ投稿がありません。</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {mine.map((s) => {
                  const st = STATUS_LABEL[s.status] || STATUS_LABEL.new
                  return (
                    <li key={s.id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{s.title}</p>
                          <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">{s.body}</p>
                          <p className="text-xs text-gray-400 mt-1">{(s.created_at || '').slice(0, 10)}</p>
                        </div>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </StudentLayout>
  )
}
