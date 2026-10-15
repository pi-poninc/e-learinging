'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  endpoint: string
  body: object
  label: string
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  redirectTo?: string
}

export function ActionButton({ endpoint, body, label, variant = 'primary', size = 'sm', redirectTo }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button variant={variant} size={size} loading={loading} onClick={async () => {
        setError(null); setLoading(true)
        try {
          const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) { setError(data.error || '失敗しました'); return }
          window.location.href = redirectTo || window.location.href
        } finally { setLoading(false) }
      }}>{label}</Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  )
}
