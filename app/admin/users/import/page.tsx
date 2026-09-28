'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Table } from '@/components/ui/table'

interface ParsedRow { name: string; email: string; password: string; valid: boolean }
interface Group { id: string; name: string }
interface Course { id: string; title: string }
interface ResultRow { email: string; ok: boolean; message: string }

function parseCsv(text: string): ParsedRow[] {
  const rows: ParsedRow[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const cols = line.split(',').map((c) => c.trim())
    // ヘッダー行はスキップ
    if (/email|メール/i.test(cols.join(',')) && /password|パスワード/i.test(cols.join(','))) continue
    let name = '', email = '', password = ''
    if (cols.length >= 3) { [name, email, password] = cols }
    else if (cols.length === 2) { [email, password] = cols }
    else continue
    const valid = !!email && !!password && password.length >= 6 && /@/.test(email)
    rows.push({ name: name || email, email, password, valid })
  }
  return rows
}

export default function BulkImportPage() {
  const supabase = useMemo(() => createClient(), [])
  const [text, setText] = useState('')
  const [groupId, setGroupId] = useState('')
  const [groups, setGroups] = useState<Group[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [courseIds, setCourseIds] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<ResultRow[] | null>(null)

  const load = useCallback(async () => {
    const gRes = await fetch('/api/admin/groups')
    if (gRes.ok) setGroups((await gRes.json()).groups || [])
    const { data } = await supabase.from('courses').select('id, title').eq('status', 'published').order('created_at')
    setCourses((data || []) as Course[])
  }, [supabase])
  useEffect(() => { load() }, [load])

  const parsed = useMemo(() => parseCsv(text), [text])
  const validRows = parsed.filter((r) => r.valid)

  const toggleCourse = (id: string) =>
    setCourseIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const runImport = async () => {
    setImporting(true); setResults(null)
    const res = await fetch('/api/admin/users/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: validRows.map((r) => ({ name: r.name, email: r.email, password: r.password, groupId: groupId || null })),
        courseIds,
      }),
    })
    const data = await res.json()
    setResults(data.results || [{ email: '', ok: false, message: data.error || '失敗' }])
    setImporting(false)
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">受講者の一括登録（CSV）</h1>
        <a href="/admin/users" className="text-sm text-blue-600 hover:underline">← ユーザー管理へ</a>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>CSVを貼り付け</CardHeader>
          <CardBody className="space-y-3">
            <p className="text-sm text-gray-500">
              1行1名。<code className="bg-gray-100 px-1">氏名, メール, パスワード</code>（氏名は省略可）。
              先頭のヘッダー行は自動でスキップします。パスワードは6文字以上。
            </p>
            <Textarea
              rows={10}
              placeholder={"山田太郎, taro@example.com, pass1234\n花子, hanako@example.com, pass5678"}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="grid sm:grid-cols-1 gap-3">
              <Select
                label="所属グループ（任意）"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                options={[{ value: '', label: '未所属' }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
              />
              <div className="text-sm text-gray-700">
                この講座に自動で受講登録（任意・複数可）
                <div className="mt-1 space-y-1 max-h-40 overflow-auto border border-gray-200 rounded-md p-2">
                  {courses.length === 0 && <p className="text-gray-400 text-sm">公開中の講座がありません</p>}
                  {courses.map((c) => (
                    <label key={c.id} className="flex items-center gap-2">
                      <input type="checkbox" checked={courseIds.includes(c.id)} onChange={() => toggleCourse(c.id)} />
                      <span>{c.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>プレビュー（有効 {validRows.length} / 全 {parsed.length} 行）</CardHeader>
          <CardBody>
            {parsed.length === 0 ? (
              <p className="text-sm text-gray-500">左にCSVを貼ると、ここに一覧が出ます。</p>
            ) : (
              <>
                <div className="max-h-72 overflow-auto">
                  <Table headers={['氏名', 'メール', '判定']}>
                    {parsed.map((r, i) => (
                      <tr key={i}>
                        <td className="px-6 py-3">{r.name}</td>
                        <td className="px-6 py-3 text-gray-600">{r.email}</td>
                        <td className="px-6 py-3">{r.valid ? <span className="text-green-600">OK</span> : <span className="text-red-600">不備</span>}</td>
                      </tr>
                    ))}
                  </Table>
                </div>
                <Button className="mt-4" loading={importing} disabled={validRows.length === 0} onClick={runImport}>
                  {validRows.length} 人を登録する
                </Button>
              </>
            )}

            {results && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="text-sm font-medium mb-2">
                  結果：成功 {results.filter((r) => r.ok).length} / {results.length}
                </p>
                <div className="max-h-48 overflow-auto text-sm space-y-1">
                  {results.map((r, i) => (
                    <div key={i} className={r.ok ? 'text-gray-600' : 'text-red-600'}>
                      {r.ok ? '✓' : '×'} {r.email} — {r.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </AdminLayout>
  )
}
