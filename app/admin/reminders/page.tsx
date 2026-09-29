'use client'

import { useState, useEffect, useCallback } from 'react'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table } from '@/components/ui/table'

interface Target {
  enrollmentId: string; email: string; name: string
  courseTitle: string; dueDate: string; overdue: boolean
}

export default function AdminRemindersPage() {
  const [targets, setTargets] = useState<Target[]>([])
  const [emailConfigured, setEmailConfigured] = useState(true)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string>('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/reminders')
    if (res.ok) {
      const d = await res.json()
      setTargets(d.targets || [])
      setEmailConfigured(d.emailConfigured)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const send = async () => {
    if (!confirm(`${targets.length} 件にリマインドメールを送信しますか？`)) return
    setSending(true); setResult('')
    const res = await fetch('/api/admin/reminders', { method: 'POST' })
    const d = await res.json()
    setResult(d.note ? d.note : `送信 ${d.sent} / ${d.total} 件${d.errors?.length ? `（失敗 ${d.errors.length}）` : ''}`)
    setSending(false)
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">受講リマインド</h1>

      {!emailConfigured && (
        <div className="mb-6 p-4 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-800">
          メール送信は未設定です（環境変数 <code>RESEND_API_KEY</code> と <code>REMINDER_FROM</code> が必要）。
          設定するまでは「対象一覧」の確認のみ行えます。
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <span>リマインド対象（期限切れ・期限が近い未修了）：{targets.length} 件</span>
            <Button onClick={send} loading={sending} disabled={targets.length === 0}>
              リマインドメール送信
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {result && <p className="mb-4 text-sm text-gray-700">{result}</p>}
          {targets.length === 0 ? (
            <p className="text-sm text-gray-500">対象はありません。</p>
          ) : (
            <Table headers={['氏名', 'メール', '講座', '期限', '状態']}>
              {targets.map((t) => (
                <tr key={t.enrollmentId}>
                  <td className="px-6 py-3">{t.name}</td>
                  <td className="px-6 py-3 text-gray-600">{t.email}</td>
                  <td className="px-6 py-3">{t.courseTitle}</td>
                  <td className="px-6 py-3">{t.dueDate}</td>
                  <td className="px-6 py-3">
                    {t.overdue ? <span className="text-red-600 font-medium">期限切れ</span> : <span className="text-amber-600">まもなく</span>}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </CardBody>
      </Card>
    </AdminLayout>
  )
}
