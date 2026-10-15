'use client'

import { useState } from 'react'

export function CohortShareToggle({ cohortId, initial }: { cohortId: string; initial: boolean }) {
  const [share, setShare] = useState(initial)
  const [saving, setSaving] = useState(false)
  return (
    <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
      <input
        type="checkbox"
        checked={share}
        disabled={saving}
        onChange={async (e) => {
          const next = e.target.checked
          setShare(next); setSaving(true)
          try {
            await fetch('/api/cohort', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'toggle_share', cohortId, share: next }),
            })
          } catch { setShare(!next) } finally { setSaving(false) }
        }}
      />
      自分の提出を仲間のタイムラインに表示する
    </label>
  )
}
