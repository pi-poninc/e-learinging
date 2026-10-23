'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Reco {
  courseId: string
  title: string
  reason: string
  pathTitle: string
  url: string
}

/** ログインユーザーの「次におすすめ」講座を表示する。該当なしなら何も出さない。 */
export function RecommendedCourses({ excludeCourseId }: { excludeCourseId?: string }) {
  const [recos, setRecos] = useState<Reco[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/recommendations')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return
        const list: Reco[] = (d?.recommendations || []).filter((x: Reco) => x.courseId !== excludeCourseId)
        setRecos(list)
        setLoaded(true)
      })
      .catch(() => alive && setLoaded(true))
    return () => {
      alive = false
    }
  }, [excludeCourseId])

  if (!loaded || recos.length === 0) return null

  return (
    <div className="mt-10">
      <h2 className="text-xl font-bold text-gray-900 mb-1">次におすすめの講座</h2>
      <p className="text-sm text-gray-500 mb-4">あなたの学習状況から、次に進むとよい講座です。</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recos.map((r) => (
          <Link
            key={r.courseId}
            href={`/courses/${r.courseId}`}
            className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-400 hover:shadow-sm transition"
          >
            <span className="inline-block text-xs font-medium text-blue-700 bg-blue-50 rounded px-2 py-0.5 mb-2">
              {r.pathTitle}
            </span>
            <h3 className="font-semibold text-gray-900 leading-snug">{r.title}</h3>
            <p className="text-xs text-gray-500 mt-1">{r.reason}</p>
            <span className="inline-block mt-3 text-sm text-blue-600 font-medium">この講座へ →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
