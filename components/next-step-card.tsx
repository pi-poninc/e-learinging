'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface JourneyItem {
  courseId: string
  title: string
  milestone: string | null
  pct: number
  done: boolean
  isNext: boolean
}
interface JourneyPath {
  id: string
  title: string
  description: string | null
  enrolled: boolean
  overallPct: number
  items: JourneyItem[]
}

// 王道ジャーニーを優先的に探す（無ければ最初の公開パス）
function pickMaster(paths: JourneyPath[]): JourneyPath | null {
  if (!paths || paths.length === 0) return null
  return paths.find((p) => p.title.startsWith('pipon流の働き方')) || paths[0]
}

export function NextStepCard() {
  const [path, setPath] = useState<JourneyPath | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/journey')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return
        setPath(d ? pickMaster(d.paths || []) : null)
        setLoaded(true)
      })
      .catch(() => alive && setLoaded(true))
    return () => {
      alive = false
    }
  }, [])

  if (!loaded || !path) return null

  const next = path.items.find((i) => i.isNext)
  const allDone = path.items.length > 0 && path.items.every((i) => i.done)

  // 王道を完走 → 「pipon流 修了」認定バッジ（金色）
  if (path.enrolled && allDone) {
    return (
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 text-white p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-3xl" aria-hidden>🏅</div>
          <div className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-50">pipon流 修了認定</span>
            <h2 className="text-xl sm:text-2xl font-bold text-balance">王道ジャーニー、完走おめでとうございます！</h2>
            <p className="text-sm text-amber-50/90 mt-1">pipon流の働き方の基本を習得しました。次は他のロードマップや実務の引き出しへ。</p>
          </div>
        </div>
        <Link href="/journey" className="inline-block mt-4 bg-white text-amber-700 font-semibold text-sm rounded-lg px-4 py-2 hover:bg-amber-50">
          次のロードマップを見る →
        </Link>
      </div>
    )
  }

  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-wide text-blue-100">次の一歩</span>
        <span className="text-xs text-blue-100">{path.title.replace('【まずここから】', '')}・{path.overallPct}%</span>
      </div>

      {!path.enrolled ? (
        <>
          <h2 className="text-xl sm:text-2xl font-bold mt-2 text-balance">まずはここから始めよう</h2>
          <p className="text-sm text-blue-50/90 mt-1">
            何から学べばいいか迷ったら、pipon流の働き方が身につく王道コースへ。順番に進めるだけでOKです。
          </p>
          <Link
            href="/journey"
            className="inline-block mt-4 bg-white text-blue-700 font-semibold text-sm rounded-lg px-4 py-2 hover:bg-blue-50"
          >
            王道ジャーニーを始める →
          </Link>
        </>
      ) : next ? (
        <>
          <h2 className="text-xl sm:text-2xl font-bold mt-2 text-balance">{next.milestone || next.title}</h2>
          <p className="text-sm text-blue-50/90 mt-1">{next.title}（{next.pct}% 完了）</p>
          <div className="w-full bg-white/25 rounded-full h-2 mt-3 max-w-xl">
            <div className="bg-white h-2 rounded-full transition-all" style={{ width: `${path.overallPct}%` }} />
          </div>
          <Link
            href={`/courses/${next.courseId}`}
            className="inline-block mt-4 bg-white text-blue-700 font-semibold text-sm rounded-lg px-4 py-2 hover:bg-blue-50"
          >
            この講座を続ける →
          </Link>
          <Link href="/journey" className="inline-block mt-4 ml-3 text-sm text-blue-100 underline hover:text-white">
            ロードマップ全体を見る
          </Link>
        </>
      ) : null}
    </div>
  )
}
