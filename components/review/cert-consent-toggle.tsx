'use client'

import { useState } from 'react'

export function CertConsentToggle({ userCertId, initial }: { userCertId: string; initial: boolean }) {
  const [consent, setConsent] = useState(initial)
  const [saving, setSaving] = useState(false)
  return (
    <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
      <input type="checkbox" checked={consent} disabled={saving}
        onChange={async (e) => {
          const next = e.target.checked; setConsent(next); setSaving(true)
          try {
            await fetch('/api/certification', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'consent', userCertId, consent: next }),
            })
          } catch { setConsent(!next) } finally { setSaving(false) }
        }} />
      確認ページ（氏名・認定名・発行日）への掲載に同意する
    </label>
  )
}
