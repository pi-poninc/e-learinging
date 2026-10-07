'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { CaseSimulation } from '@/lib/db'

const TEMPLATE = {
  intro: {
    kicker: '案件追体験シリーズ ｜ 第N章',
    heading: 'あなたは、この案件のFDEだ。',
    paragraphs: ['案件の背景をここに書く。', 'これから訪れる岐路で、現場でどう動くかを選ぶ。'],
    facts: [
      { l: '案件', v: '〇〇' },
      { l: '体制', v: '〇〇' },
      { l: 'あなたの役割', v: 'FDE' },
      { l: 'このフェーズ', v: '〇〇' },
    ],
    note: '本教材は実案件のログをもとに再構成したケーススタディです。顧客名・個人名は一般化しています。',
  },
  roles: {
    you: { name: 'あなた', role: 'FDE・pipon', tag: 'FDE', color: '#0b7a6e' },
    pm: { name: '連携PM', role: '企画統括', tag: 'PM', color: '#4451b8' },
  },
  scenes: [
    {
      ch: '局面 01',
      title: '局面のタイトル',
      lead: '状況の説明。',
      thread: [{ role: 'pm', ts: '09:00', text: 'メッセージ本文。' }],
      ask: 'あなたはどう動く？',
      sub: '補足の一言。',
      options: [
        { text: '選択肢A' },
        { text: '選択肢B（実際の判断）', actual: true },
        { text: '選択肢C' },
      ],
      verdictHit: '実際のpiponも同じ判断だった。',
      verdictMiss: '実際のpiponは別の判断をした。',
      did: '実際にやったことの説明。',
      learn: '学びのポイント。',
    },
  ],
  recap: [{ t: '型の見出し', d: '一行説明' }],
  next: { label: '次章予告', title: '第N+1章：〇〇', desc: '次に扱う内容。' },
}

export default function EditCasePage() {
  const params = useParams()
  const caseId = params.caseId as string
  const supabase = useMemo(() => createClient(), [])

  const [sim, setSim] = useState<CaseSimulation | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [scenarioText, setScenarioText] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [sceneCount, setSceneCount] = useState(0)

  const validate = useCallback((text: string) => {
    try {
      const obj = JSON.parse(text)
      if (!obj || typeof obj !== 'object') throw new Error('オブジェクトではありません')
      const scenes = obj.scenes
      if (!Array.isArray(scenes)) throw new Error('scenes 配列がありません')
      for (let i = 0; i < scenes.length; i++) {
        const s = scenes[i]
        if (!Array.isArray(s.options) || s.options.length < 2) throw new Error(`局面${i + 1}: options は2つ以上必要`)
        if (!s.options.some((o: { actual?: boolean }) => o.actual)) throw new Error(`局面${i + 1}: actual:true の選択肢が必要`)
      }
      setJsonError('')
      setSceneCount(scenes.length)
      return obj
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'JSONを解析できません')
      return null
    }
  }, [])

  const loadData = useCallback(async () => {
    const { data } = await supabase.from('case_simulations').select('*').eq('id', caseId).single()
    if (data) {
      setSim(data as CaseSimulation)
      const text = JSON.stringify((data as CaseSimulation).scenario ?? {}, null, 2)
      setScenarioText(text)
      validate(text)
    }
    setLoading(false)
  }, [caseId, supabase, validate])

  useEffect(() => { loadData() }, [loadData])

  const handleSaveMeta = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true); setError(''); setNotice('')
    const fd = new FormData(e.currentTarget)
    const { error: err } = await supabase.from('case_simulations').update({
      title: fd.get('title') as string,
      description: (fd.get('description') as string) || null,
      status: fd.get('status') as string,
      sort_order: parseInt((fd.get('sort_order') as string) || '0', 10),
    }).eq('id', caseId)
    if (err) setError(err.message); else setNotice('基本情報を保存しました。')
    setSaving(false)
  }

  const handleSaveScenario = async () => {
    const obj = validate(scenarioText)
    if (!obj) { setError('シナリオJSONにエラーがあります。'); return }
    setSaving(true); setError(''); setNotice('')
    const { error: err } = await supabase.from('case_simulations')
      .update({ scenario: obj }).eq('id', caseId)
    if (err) setError(err.message); else setNotice('シナリオを保存しました。')
    setSaving(false)
  }

  const handleFormat = () => {
    const obj = validate(scenarioText)
    if (obj) setScenarioText(JSON.stringify(obj, null, 2))
  }

  const handleTemplate = () => {
    const text = JSON.stringify(TEMPLATE, null, 2)
    setScenarioText(text)
    validate(text)
  }

  if (loading) return <AdminLayout><p className="text-gray-500">読み込み中...</p></AdminLayout>
  if (!sim) return <AdminLayout><p className="text-red-600">シミュレーターが見つかりません。</p></AdminLayout>

  return (
    <AdminLayout>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">案件シミュレーターを編集</h1>
        <Link href={`/cases/${caseId}`} target="_blank">
          <Button variant="secondary" size="sm">プレビュー ↗</Button>
        </Link>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">{error}</div>}
      {notice && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">{notice}</div>}

      <Card className="mb-6 max-w-2xl">
        <CardHeader><h2 className="text-lg font-semibold">基本情報</h2></CardHeader>
        <CardBody>
          <form onSubmit={handleSaveMeta} className="space-y-4">
            <Input label="タイトル" name="title" required defaultValue={sim.title} />
            <Input label="説明（任意）" name="description" defaultValue={sim.description || ''} />
            <Input label="並び順 (sort_order)" name="sort_order" type="number" defaultValue={String(sim.sort_order)} />
            <Select label="ステータス" name="status" defaultValue={sim.status} options={[
              { value: 'draft', label: '下書き' }, { value: 'published', label: '公開' }, { value: 'archived', label: 'アーカイブ' },
            ]} />
            <Button type="submit" loading={saving}>基本情報を保存</Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold">シナリオ (JSON)</h2>
            <div className="flex items-center gap-2">
              {jsonError
                ? <Badge variant="danger">JSONエラー</Badge>
                : <Badge variant="success">OK ・ 局面 {sceneCount}</Badge>}
              <Button variant="ghost" size="sm" onClick={handleTemplate}>テンプレ挿入</Button>
              <Button variant="ghost" size="sm" onClick={handleFormat}>整形</Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-gray-500 mb-3">
            intro（導入）／ roles（登場人物）／ scenes（局面の配列。各局面は thread・options・did・learn 等）／ recap（まとめ）／ next（次章予告）を持つオブジェクトです。各局面の options には <code className="bg-gray-100 px-1 rounded">&quot;actual&quot;: true</code> を1つ付けてください。
          </p>
          {jsonError && <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">⚠ {jsonError}</div>}
          <textarea
            id="scenario-json"
            value={scenarioText}
            onChange={(e) => { setScenarioText(e.target.value); validate(e.target.value) }}
            spellCheck={false}
            className="w-full h-[480px] font-mono text-xs leading-relaxed p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
          />
          <div className="mt-4 flex gap-3">
            <Button onClick={handleSaveScenario} loading={saving} disabled={!!jsonError}>シナリオを保存</Button>
          </div>
        </CardBody>
      </Card>
    </AdminLayout>
  )
}
