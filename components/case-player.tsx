'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CaseScenario, CaseInfoCard } from '@/lib/db'

interface CasePlayerProps {
  caseId: string
  title: string
  scenario: CaseScenario
  alreadyCompleted: boolean
  isAdmin?: boolean
}

function Avatar({ role, scenario }: { role: string; scenario: CaseScenario }) {
  const r = scenario.roles?.[role] || { tag: '?', color: '#64748b', name: role, role: '' }
  return (
    <span
      className="flex-none w-9 h-9 rounded-lg grid place-items-center text-[0.62rem] font-semibold text-white tracking-wide"
      style={{ background: r.color }}
    >
      {r.tag}
    </span>
  )
}

function InfoCards({ cards }: { cards: CaseInfoCard[] }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3 mt-4">
      {cards.map((c, i) => (
        <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-3.5">
          <div className="font-mono text-[0.66rem] tracking-[0.1em] uppercase text-teal-600 mb-2">{c.label}</div>
          <ul className="space-y-1.5">
            {c.items.map((it, j) => (
              <li key={j} className="text-[0.86rem] text-gray-700 leading-relaxed flex gap-2">
                <span className="text-gray-300 flex-none mt-[1px]">—</span><span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function Thread({ scene, scenario }: { scene: CaseScenario['scenes'][number]; scenario: CaseScenario }) {
  if (!scene.thread?.length) return null
  return (
    <>
      <p className="font-mono text-[0.72rem] text-gray-400 tracking-wide mt-5 mb-2.5">現場ログ（再構成）</p>
      <div className="flex flex-col gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3.5">
        {scene.thread.map((m, i) => {
          const r = scenario.roles?.[m.role]
          return (
            <div key={i} className="flex gap-3 items-start">
              <Avatar role={m.role} scenario={scenario} />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap leading-tight">
                  <span className="font-bold text-sm text-gray-900">{r?.name || m.role}</span>
                  {r?.role && <span className="text-[0.72rem] text-gray-400">{r.role}</span>}
                  <span className="font-mono text-[0.68rem] text-gray-400">{m.ts}</span>
                </div>
                <div className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{m.text}</div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

export function CasePlayer({ caseId, title, scenario, alreadyCompleted, isAdmin }: CasePlayerProps) {
  const scenes = scenario.scenes || []
  const [idx, setIdx] = useState(-1) // -1 intro, 0..n-1 scenes, n outro
  const [picks, setPicks] = useState<(number | null)[]>(() => scenes.map(() => null))
  const [decided, setDecided] = useState(false) // このシーンで「判断する」まで進んだか
  const [saved, setSaved] = useState(false)

  // シーンが変わったら、ブリーフィング段階に戻す（ただし既に回答済みなら判断表示のまま）
  useEffect(() => {
    if (idx >= 0 && idx < scenes.length) setDecided(picks[idx] != null)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const score = picks.filter((p, i) => p != null && scenes[i]?.options?.[p]?.actual).length

  const saveCompletion = useCallback(async (finalPicks: (number | null)[]) => {
    const s = finalPicks.filter((p, i) => p != null && scenes[i]?.options?.[p]?.actual).length
    try {
      await fetch('/api/cases/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          pathTaken: finalPicks.map((p) => (p == null ? -1 : p)),
          score: s,
          total: scenes.length,
        }),
      })
      setSaved(true)
    } catch {
      // best-effort
    }
  }, [caseId, scenes])

  const goTo = (n: number) => {
    setIdx(n)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
    if (n >= scenes.length && !saved && !alreadyCompleted) saveCompletion(picks)
  }

  const pick = (optionIdx: number) => {
    if (picks[idx] != null) return
    const next = [...picks]
    next[idx] = optionIdx
    setPicks(next)
  }

  // ---------- INTRO ----------
  if (idx < 0) {
    const intro = scenario.intro
    return (
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 sm:p-8">
        {alreadyCompleted && (
          <span className="inline-block mb-4 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-3 py-1">
            受講済み ― もう一度挑戦できます
          </span>
        )}
        <p className="font-mono text-xs tracking-[0.14em] uppercase text-teal-600 mb-2">{intro?.kicker || '案件追体験'}</p>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 text-balance">{intro?.heading || title}</h2>
        {(intro?.paragraphs || []).map((p, i) => (
          <p key={i} className="text-gray-600 mb-3 leading-relaxed">{p}</p>
        ))}
        {intro?.facts?.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-5">
            {intro.facts.map((f, i) => (
              <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3">
                <div className="font-mono text-[0.62rem] tracking-wider uppercase text-gray-400 mb-1">{f.l}</div>
                <div className="font-bold text-sm text-gray-900">{f.v}</div>
              </div>
            ))}
          </div>
        )}
        {intro?.dossier?.length ? (
          <div className="mt-2">
            <p className="font-mono text-[0.72rem] tracking-[0.1em] uppercase text-gray-400 mb-1">案件ブリーフィング</p>
            <InfoCards cards={intro.dossier} />
          </div>
        ) : null}
        {scenario.roles && (
          <div className="flex flex-wrap gap-2 mt-5 mb-2">
            {Object.keys(scenario.roles).map((k) => (
              <span key={k} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full pl-1 pr-3 py-1 text-xs">
                <Avatar role={k} scenario={scenario} />
                <span className="text-gray-700">{scenario.roles[k].name}・{scenario.roles[k].role}</span>
              </span>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-6">
          <button onClick={() => goTo(0)} className="rounded-xl bg-teal-600 text-white font-bold px-6 py-3 shadow-sm hover:bg-teal-700 transition">
            案件を始める →
          </button>
        </div>
        {intro?.note && <p className="text-xs text-gray-400 mt-5 leading-relaxed">{intro.note}</p>}
      </div>
    )
  }

  // ---------- OUTRO ----------
  if (idx >= scenes.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 sm:p-8">
        <p className="font-mono text-xs tracking-[0.14em] uppercase text-teal-600 mb-2">完了</p>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 text-balance">あなたの判断を、答え合わせ。</h2>
        <div className="flex items-center gap-5 bg-teal-50 border border-teal-200 rounded-2xl px-5 py-4 mb-6">
          <div className="text-5xl font-extrabold text-teal-600 tabular-nums leading-none">
            {score}<span className="text-xl text-gray-500 font-bold">／{scenes.length}</span>
          </div>
          <p className="text-sm text-gray-600">
            {scenes.length}つの岐路のうち <b>{score}つ</b> で、実際のpiponと同じ判断を選べました。一致数より、<b>なぜその判断になるのか</b>の型を持ち帰るのがねらいです。
          </p>
        </div>
        {scenario.recap?.length > 0 && (
          <>
            <h3 className="font-bold text-gray-900 mb-2">持ち帰る「型」</h3>
            <ol className="mb-6">
              {scenario.recap.map((r, i) => (
                <li key={i} className="flex gap-3 items-start py-2.5 border-b border-gray-100 last:border-0">
                  <span className="flex-none w-6 h-6 rounded-lg bg-teal-600 text-white font-mono text-xs grid place-items-center mt-0.5">{i + 1}</span>
                  <div>
                    <div className="font-bold text-sm text-gray-900">{r.t}</div>
                    <div className="text-sm text-gray-500">{r.d}</div>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
        {scenario.next && (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl px-4 py-4 mb-2">
            <div className="font-mono text-[0.66rem] tracking-wider uppercase text-teal-600 mb-1">▶ {scenario.next.label}</div>
            <div className="font-bold text-gray-900">{scenario.next.title}</div>
            <div className="text-sm text-gray-500 mt-0.5">{scenario.next.desc}</div>
          </div>
        )}
        <div className="flex justify-between items-center mt-6">
          <button onClick={() => goTo(scenes.length - 1)} className="font-mono text-xs text-gray-400 hover:text-gray-600">← 局面を見直す</button>
          <button onClick={() => { setPicks(scenes.map(() => null)); setSaved(false); goTo(-1) }} className="rounded-xl bg-teal-600 text-white font-bold px-6 py-3 shadow-sm hover:bg-teal-700 transition">
            もう一度挑戦する ↺
          </button>
        </div>
        {!alreadyCompleted && (
          <p className="text-xs text-gray-400 mt-4">{saved ? '✓ 完了を記録しました。' : (isAdmin ? '（管理者プレビュー：完了は記録されません）' : '完了を記録中…')}</p>
        )}
      </div>
    )
  }

  // ---------- SCENE ----------
  const s = scenes[idx]
  const picked = picks[idx]
  const graded = picked != null
  const showOptions = decided || graded

  return (
    <div>
      {/* progress rail */}
      <div className="flex gap-1.5 mb-5">
        {scenes.map((_, i) => (
          <div key={i} className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full bg-teal-500 transition-all duration-500"
              style={{ width: i < idx || picks[i] != null ? '100%' : (i === idx ? '40%' : '0%') }} />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 sm:p-8">
        {/* ===== ブリーフィング ===== */}
        <p className="font-mono text-[0.72rem] tracking-[0.1em] uppercase text-gray-400 mb-1.5 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />{s.ch} ／ 全{scenes.length}局面
          <span className="ml-auto normal-case tracking-normal text-gray-400">{showOptions ? '② 判断' : '① ブリーフィング'}</span>
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 text-balance leading-snug">{s.title}</h2>

        {(s.situation?.length ? s.situation : [s.lead]).map((p, i) => (
          <p key={i} className="text-gray-600 leading-relaxed mb-2.5">{p}</p>
        ))}

        {s.brief?.length ? <InfoCards cards={s.brief} /> : null}

        <Thread scene={s} scenario={scenario} />

        {/* ===== ゲート ===== */}
        {!showOptions && (
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400 mb-3">— ここまでが、あなたに与えられた情報です —</p>
            <button onClick={() => setDecided(true)} className="rounded-xl bg-teal-600 text-white font-bold px-6 py-3 shadow-sm hover:bg-teal-700 transition">
              この状況で、判断する →
            </button>
          </div>
        )}

        {/* ===== 意思決定 ===== */}
        {showOptions && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="font-bold text-gray-900 flex gap-2 items-baseline">
              <span className="font-mono text-teal-600">Q.</span><span>{s.ask}</span>
            </p>
            {s.sub && <p className="text-xs text-gray-400 mb-3.5 mt-0.5">{s.sub}</p>}
            <div className="flex flex-col gap-2.5">
              {s.options.map((o, i) => {
                let cls = 'flex gap-3 items-start w-full text-left rounded-xl border px-4 py-3 text-sm leading-relaxed transition '
                if (!graded) cls += 'bg-gray-50 border-gray-200 hover:border-teal-500 hover:bg-teal-50 cursor-pointer'
                else if (o.actual) cls += 'bg-green-50 border-green-500'
                else if (i === picked) cls += 'bg-amber-50 border-amber-400'
                else cls += 'bg-gray-50 border-gray-200 opacity-60'
                const tagCls = 'flex-none w-6 h-6 rounded-md grid place-items-center font-mono text-xs font-medium ' +
                  (graded && o.actual ? 'bg-green-600 text-white' : graded && i === picked ? 'bg-amber-500 text-white' : 'bg-white border border-gray-200 text-gray-500')
                return (
                  <button key={i} className={cls} disabled={graded} onClick={() => pick(i)}>
                    <span className={tagCls}>{String.fromCharCode(65 + i)}</span>
                    <span className="text-gray-800">{o.text}</span>
                    {graded && o.actual && <span className="ml-auto self-center font-mono text-[0.62rem] tracking-wider uppercase bg-green-600 text-white rounded-full px-2 py-0.5 whitespace-nowrap">実際の判断</span>}
                    {graded && i === picked && !o.actual && <span className="ml-auto self-center font-mono text-[0.62rem] tracking-wider uppercase bg-amber-500 text-white rounded-full px-2 py-0.5 whitespace-nowrap">あなた</span>}
                  </button>
                )
              })}
            </div>

            {/* ===== 答え合わせ ===== */}
            {graded && (
              <div className="mt-4 border-l-[3px] border-teal-500 bg-gray-50 rounded-r-xl px-4 py-4">
                <h4 className="font-bold text-gray-900 flex items-center gap-2 text-[0.96rem]">
                  実際の現場では
                  <span className={'font-mono text-[0.66rem] tracking-wide uppercase rounded-full px-2 py-0.5 ' + (s.options[picked].actual ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                    {s.options[picked].actual ? 'あなたと同じ判断' : '別の判断だった'}
                  </span>
                </h4>
                <p className="text-sm text-gray-600 mt-1.5">{s.options[picked].actual ? s.verdictHit : s.verdictMiss}</p>
                <p className="text-sm text-gray-600 mt-1.5">{s.did}</p>
                {s.outcome && (
                  <p className="text-sm text-gray-600 mt-1.5"><span className="font-mono text-[0.66rem] tracking-wider uppercase text-gray-400 mr-1.5">その後</span>{s.outcome}</p>
                )}
                <div className="mt-3 pt-3 border-t border-dashed border-gray-300">
                  <b className="block font-mono text-[0.68rem] tracking-[0.1em] uppercase text-teal-600 mb-1">学びのポイント</b>
                  <p className="text-sm text-gray-900">{s.learn}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== ナビ ===== */}
        <div className="flex justify-between items-center mt-6">
          <button onClick={() => goTo(idx - 1)} className="font-mono text-xs text-gray-400 hover:text-gray-600">
            {idx === 0 ? '← 概要へ' : '← 戻る'}
          </button>
          <button onClick={() => graded && goTo(idx + 1)} disabled={!graded}
            className="rounded-xl bg-teal-600 text-white font-bold px-6 py-3 shadow-sm hover:bg-teal-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
            {idx === scenes.length - 1 ? '結果を見る →' : '次の局面へ →'}
          </button>
        </div>
      </div>
    </div>
  )
}
