'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Resp {
  level: { level: number; title: string; xp: number; levelSpan: number; intoLevel: number; pctToNext: number }
  paths: { title: string; enrolled: boolean; items: { title: string; isNext: boolean; courseId: string }[] }[]
}

export function FdeLevelCard() {
  const [d, setD] = useState<Resp | null>(null)
  useEffect(() => {
    fetch('/api/journey').then((r) => r.ok ? r.json() : null).then(setD).catch(() => {})
  }, [])
  if (!d || !d.level) return null
  const lv = d.level
  const enrolledPath = d.paths.find((p) => p.enrolled)
  const next = enrolledPath?.items.find((i) => i.isNext)

  return (
    <Link href="/journey" className="block mb-6">
      <div className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-4 shadow-sm hover:brightness-105 transition">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-none grid place-items-center w-16 h-16 rounded-xl bg-white/15 border border-white/30">
            <div className="text-[0.55rem] font-mono tracking-widest uppercase opacity-80">FDE Lv</div>
            <div className="text-2xl font-extrabold leading-none tabular-nums">{lv.level}</div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold">{lv.title}
              <span className="ml-2 text-xs font-normal text-white/70">
                {lv.level >= 100 ? '最高到達' : `次のLvまで あと ${Math.max(0, lv.levelSpan - lv.intoLevel)} XP`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden max-w-sm mt-1.5">
              <div className="h-full bg-white rounded-full" style={{ width: `${lv.pctToNext}%` }} />
            </div>
            {next && <div className="text-xs text-white/85 mt-1.5">▶ 次はこれ：{next.title}</div>}
          </div>
          <div className="flex-none text-sm font-medium text-white/90">ロードマップへ →</div>
        </div>
      </div>
    </Link>
  )
}
