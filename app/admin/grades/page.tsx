import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { skillMapEnabled } from '@/lib/flags'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody } from '@/components/ui/card'
import { GradeActions } from '@/components/review/grade-actions'
import { notFound } from 'next/navigation'

export default async function AdminGradesPage() {
  if (!skillMapEnabled()) notFound()
  await requireStaff()
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('user_grades')
    .select('id, created_at, evidence, user:profiles(name), grade:grades(name, level)')
    .eq('status', 'eligible')
    .order('created_at', { ascending: true })

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">グレード承認</h1>
      <p className="text-sm text-gray-500 mb-6">条件を満たした受講者です。根拠を確認して承認／差し戻ししてください（グレードは自動では上がりません）。</p>

      {(!rows || rows.length === 0) && (
        <Card><CardBody><p className="text-sm text-gray-500">承認待ちのグレードはありません。</p></CardBody></Card>
      )}

      <div className="space-y-3">
        {(rows || []).map((r) => {
          const u = r.user as unknown as { name: string | null } | null
          const g = r.grade as unknown as { name: string; level: number } | null
          const ev = (r.evidence || {}) as { skill_levels?: Record<string, { level: number; confidence: string }> }
          return (
            <Card key={r.id}><CardBody>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">{u?.name || '受講者'} → <span className="text-blue-600">{g?.name}</span></p>
                  <p className="text-xs text-gray-400 mt-1">判定日: {new Date(r.created_at).toLocaleString('ja-JP')}</p>
                  {ev.skill_levels && (
                    <p className="text-xs text-gray-500 mt-2">
                      根拠スキル数: {Object.keys(ev.skill_levels).length}（確度lowは判定に不使用）
                    </p>
                  )}
                </div>
                <div className="shrink-0 w-64"><GradeActions userGradeId={r.id} /></div>
              </div>
            </CardBody></Card>
          )
        })}
      </div>
    </AdminLayout>
  )
}
