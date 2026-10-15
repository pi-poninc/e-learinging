import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { peerReviewEnabled } from '@/lib/flags'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody } from '@/components/ui/card'
import { ActionButton } from '@/components/review/action-button'
import { notFound } from 'next/navigation'

// 認定条件（運用で調整可）: グレード5(リード)以上 ＆ ピアレビュー3件以上
const MIN_GRADE = 5
const MIN_PEER = 3

export default async function ReviewerCandidatesPage() {
  if (!peerReviewEnabled()) notFound()
  await requireStaff()
  const supabase = await createClient()

  const { data: ugs } = await supabase
    .from('user_grades').select('user_id, grade:grades(level, course_id)').eq('status', 'approved')
  const maxGrade = new Map<string, number>()
  const courseByUser = new Map<string, string>()
  for (const g of ugs || []) {
    const gr = g.grade as unknown as { level: number; course_id: string } | null
    if (!gr) continue
    if ((maxGrade.get(g.user_id) ?? 0) < gr.level) { maxGrade.set(g.user_id, gr.level); courseByUser.set(g.user_id, gr.course_id) }
  }

  const { data: prs } = await supabase.from('peer_reviews').select('reviewer_id, helpfulness')
  const peerCount = new Map<string, number>()
  const peerHelpSum = new Map<string, { sum: number; n: number }>()
  for (const p of prs || []) {
    peerCount.set(p.reviewer_id, (peerCount.get(p.reviewer_id) ?? 0) + 1)
    if (p.helpfulness) {
      const h = peerHelpSum.get(p.reviewer_id) ?? { sum: 0, n: 0 }
      h.sum += p.helpfulness; h.n += 1; peerHelpSum.set(p.reviewer_id, h)
    }
  }

  const { data: rps } = await supabase.from('reviewer_profiles').select('user_id')
  const already = new Set((rps || []).map((r) => r.user_id))

  const candidateIds = [...maxGrade.entries()]
    .filter(([uid, lv]) => lv >= MIN_GRADE && (peerCount.get(uid) ?? 0) >= MIN_PEER && !already.has(uid))
    .map(([uid]) => uid)

  const names = new Map<string, string>()
  if (candidateIds.length) {
    const { data: profs } = await supabase.from('profiles').select('id, name').in('id', candidateIds)
    for (const p of profs || []) names.set(p.id, p.name || '受講者')
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">添削者の認定候補</h1>
      <p className="text-sm text-gray-500 mb-6">
        条件：グレード{MIN_GRADE}以上 ＆ ピアレビュー{MIN_PEER}件以上。認定すると添削キューに参加できます（最初の数件はベテランが確認）。
      </p>

      {candidateIds.length === 0 && (
        <Card><CardBody><p className="text-sm text-gray-500">現在、条件を満たす候補はいません。</p></CardBody></Card>
      )}

      <div className="space-y-2">
        {candidateIds.map((uid) => {
          const h = peerHelpSum.get(uid)
          return (
            <Card key={uid}><CardBody>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">{names.get(uid)}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    グレード {maxGrade.get(uid)}／ピアレビュー {peerCount.get(uid)}件
                    {h && h.n > 0 && `／役に立った度 平均 ${(h.sum / h.n).toFixed(1)}`}
                  </p>
                </div>
                <ActionButton endpoint="/api/admin/reviewers/promote" body={{ userId: uid, courseId: courseByUser.get(uid) }} label="添削者に認定" />
              </div>
            </CardBody></Card>
          )
        })}
      </div>
    </AdminLayout>
  )
}
