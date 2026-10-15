'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

/** 購入ボタン。Checkout セッションを作って Stripe の決済ページへ遷移する。 */
export function BuyCourseButton({ courseId, label }: { courseId: string; label: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const buy = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.url) {
        window.location.href = d.url
        return
      }
      setError(d.error || '決済ページを開けませんでした')
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button onClick={buy} disabled={loading}>{loading ? '処理中…' : label}</Button>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  )
}
