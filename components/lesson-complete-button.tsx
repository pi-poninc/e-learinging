'use client'

import { useState } from 'react'

interface Props {
  lessonId: string
  initialCompleted: boolean
}

// 動画の無い（読み物）レッスンを「完了」にするためのボタン。
// 動画レッスンは vimeo-player 側で完了が記録されるため、ここは body のみのレッスン用。
export function LessonCompleteButton({ lessonId, initialCompleted }: Props) {
  const [done, setDone] = useState(initialCompleted)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const mark = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/lesson-progress/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId }),
      })
      if (res.ok) setDone(true)
      else {
        const d = await res.json().catch(() => ({}))
        setError(d.error || '記録に失敗しました')
      }
    } catch {
      setError('ネットワークエラーが発生しました')
    }
    setLoading(false)
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        このレッスンは完了しました
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={mark}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? '記録中…' : '読んだ・完了にする'}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
