'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

export function LessonNotes({ lessonId }: { lessonId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 初期ロード（自分のメモ）
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!active || !user) return
      setUserId(user.id)
      const { data } = await supabase
        .from('lesson_notes')
        .select('body')
        .eq('user_id', user.id)
        .eq('lesson_id', lessonId)
        .maybeSingle()
      if (active && data?.body) setBody(data.body)
    })()
    return () => { active = false }
  }, [supabase, lessonId])

  const save = useCallback(async (text: string) => {
    if (!userId) return
    setStatus('saving')
    const { error } = await supabase.from('lesson_notes').upsert(
      { user_id: userId, lesson_id: lessonId, body: text, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,lesson_id' }
    )
    setStatus(error ? 'idle' : 'saved')
  }, [supabase, userId, lessonId])

  const onChange = (text: string) => {
    setBody(text)
    setStatus('idle')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => save(text), 800) // 入力停止から0.8秒で自動保存
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <span>学びメモ（自分だけが見られます）</span>
          <span className="text-xs text-gray-400">
            {status === 'saving' ? '保存中…' : status === 'saved' ? '保存しました' : ''}
          </span>
        </div>
      </CardHeader>
      <CardBody>
        <Textarea
          rows={5}
          placeholder="このレッスンで学んだこと・気づき・あとで試したいことをメモ…（自動保存）"
          value={body}
          onChange={(e) => onChange(e.target.value)}
        />
      </CardBody>
    </Card>
  )
}
