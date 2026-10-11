'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface LevelInfo {
  xp: number; level: number; title: string
  intoLevel: number; levelSpan: number; nextLevelXp: number; pctToNext: number
  breakdown: { lessons: number; quizzes: number; cases: number; assignments: number }
}
interface PItem {
  id: string; courseId: string; title: string; milestone: string | null
  targetDays: number | null; dueDate: string | null
  total: number; doneCount: number; pct: number; done: boolean; isNext: boolean
}
interface PPath {
  id: string; title: string; description: string | null
  enrolled: boolean; startedAt: string | null; overallPct: number; items: PItem[]
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function JourneyClient() {
  const [level, setLevel] = useState<LevelInfo | null>(null)
  const [paths, setPaths] = useState<PPath[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/journey')
      if (res.ok) {
        const d = await res.json()
        setLevel(d.level); setPaths(d.paths || [])
      }
    } catch { /* noop */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const start = async (pathId: string) => {
    setBusy(pathId)
    try {
      await fetch('/api/paths/enroll', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathId }),
      })
      await load()
    } catch { /* noop */ }
    setBusy(null)
  }

  if (loading) return <p className="text-gray-500">読み込み中...</p>

  return (
    <div className="space-y-8">
      {/* FDE Level */}
      {level && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-6 text-white flex items-center gap-6 flex-wrap">
            <div className="flex-none grid place-items-center w-24 h-24 rounded-2xl bg-white/15 border border-white/30">
              <div className="text-[0.6rem] font-mono tracking-widest uppercase opacity-80">FDE Lv</div>
              <div className="text-4xl font-extrabold leading-none tabular-nums">{level.level}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold">{level.title}</div>
              <div className="text-sm text-white/80 mb-2">
                {level.level >= 100 ? '最高到達' : `次のレベルまで あと ${Math.max(0, level.levelSpan - level.intoLevel)} XP`}
                <span className="ml-2 font-mono">／ 累計 {level.xp} XP</span>
              </div>
              <div className="h-2.5 rounded-full bg-white/20 overflow-hidden max-w-md">
                <div className="h-full bg-white rounded-full transition-all" style={{ width: `${level.pctToNext}%` }} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100 border-t border-gray-100">
            {[['レッスン', level.breakdown.lessons], ['クイズ', level.breakdown.quizzes],
              ['案件追体験', level.breakdown.cases], ['課題', level.breakdown.assignments]].map(([l, v]) => (
              <div key={l as string} className="px-4 py-3 text-center">
                <div className="text-xl font-bold text-gray-900 tabular-nums">{v as number}</div>
                <div className="text-xs text-gray-500">{l as string} 完了</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Paths */}
      {paths.length === 0 && (
        <p className="text-gray-500 text-sm">公開中の学習ロードマップはまだありません。</p>
      )}
      {paths.map((p) => (
        <div key={p.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900">{p.title}</h2>
              {p.description && <p className="text-sm text-gray-500 mt-0.5">{p.description}</p>}
            </div>
            {p.enrolled ? (
              <div className="text-right flex-none">
                {p.overallPct >= 100 ? (
                  <span className="inline-block rounded-full bg-green-600 text-white text-sm font-bold px-3 py-1">🎓 修了！</span>
                ) : (
                  <div className="text-2xl font-extrabold text-blue-600 tabular-nums leading-none">{p.overallPct}%</div>
                )}
                <div className="text-xs text-gray-400 mt-0.5">
                  {p.startedAt ? `${fmtDate(p.startedAt)} 開始` : ''}
                </div>
              </div>
            ) : (
              <button onClick={() => start(p.id)} disabled={busy === p.id}
                className="flex-none rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {busy === p.id ? '開始中…' : 'このロードマップを始める'}
              </button>
            )}
          </div>
          {p.enrolled && (
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-4 mt-2">
              <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${p.overallPct}%` }} />
            </div>
          )}

          <ol className="relative border-l-2 border-gray-100 ml-3 mt-4 space-y-4">
            {p.items.map((it, idx) => {
              const dot = it.done ? 'bg-green-500 border-green-500'
                : it.isNext ? 'bg-blue-600 border-blue-600'
                  : it.pct > 0 ? 'bg-white border-blue-500' : 'bg-white border-gray-300'
              const overdue = !it.done && it.dueDate && new Date(it.dueDate) < new Date()
              return (
                <li key={it.id} className="ml-5 relative">
                  <span className={`absolute -left-[1.62rem] top-1 w-4 h-4 rounded-full border-2 ${dot}`} />
                  <Link href={`/courses/${it.courseId}`}
                    className="block rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50/40 transition px-4 py-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-gray-400">{String(idx + 1).padStart(2, '0')}</span>
                        {it.milestone && (
                          <span className="text-[0.66rem] font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">{it.milestone}</span>
                        )}
                        <span className="font-medium text-gray-900 text-sm">{it.title}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-none">
                        {it.done ? <span className="text-xs font-medium text-green-600">✓ 完了</span>
                          : it.isNext ? <span className="text-xs font-medium text-blue-600">▶ 次はこれ</span>
                            : it.pct > 0 ? <span className="text-xs text-gray-500 tabular-nums">{it.pct}%</span>
                              : <span className="text-xs text-gray-400">未着手</span>}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                        <div className={`h-full rounded-full ${it.done ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${it.pct}%` }} />
                      </div>
                      <span className="text-[0.68rem] text-gray-400 tabular-nums flex-none">{it.doneCount}/{it.total}</span>
                      {it.dueDate && !it.done && (
                        <span className={`text-[0.68rem] flex-none font-medium ${overdue ? 'text-red-600' : 'text-gray-500'}`}>
                          目標 {fmtDate(it.dueDate)}{overdue ? '（超過）' : ''}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </div>
  )
}
