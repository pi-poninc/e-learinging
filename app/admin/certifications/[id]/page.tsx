import { requireStaff } from '@/lib/auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { certificationEnabled } from '@/lib/flags'
import { certificationEligible, CertRequirements } from '@/lib/review/certification'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ActionButton } from '@/components/review/action-button'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface Props { params: Promise<{ id: string }> }

export default async function AdminCertDetailPage({ params }: Props) {
  if (!certificationEnabled()) notFound()
  const { id } = await params
  await requireStaff()
  const supabase = await createClient()

  const { data: cert } = await supabase.from('certifications').select('id, name, course_id, requirements, course:courses(title)').eq('id', id).maybeSingle()
  if (!cert) notFound()
  const req = (cert.requirements || {}) as CertRequirements
  const courseId = cert.course_id

  const svc = await createServiceClient()
  // 受講者
  const { data: enr } = await svc.from('enrollments').select('user_id').eq('course_id', courseId).eq('status', 'active')
  const userIds: string[] = (enr || []).map((e: { user_id: string }) => e.user_id)
  const names = new Map<string, string>()
  if (userIds.length) { const { data: p } = await svc.from('profiles').select('id, name').in('id', userIds); for (const x of p || []) names.set(x.id, x.name || '受講者') }

  // 承認済みグレード段階（コース）
  const { data: grades } = await svc.from('grades').select('id, level').eq('course_id', courseId)
  const gradeLevel = new Map<string, number>((grades || []).map((g: { id: string; level: number }) => [g.id, g.level]))
  const { data: ug } = await svc.from('user_grades').select('user_id, grade_id').eq('status', 'approved').in('user_id', userIds.length ? userIds : ['x'])
  const maxGrade = new Map<string, number>()
  for (const g of ug || []) maxGrade.set(g.user_id, Math.max(maxGrade.get(g.user_id) || 0, gradeLevel.get(g.grade_id) || 0))

  // 添削済み課題
  const reviewedByUser = new Map<string, Set<string>>()
  if (req.required_task_ids?.length) {
    const { data: rs } = await svc.from('review_submissions').select('user_id, task_id').eq('course_id', courseId).eq('status', 'reviewed').in('user_id', userIds.length ? userIds : ['x'])
    for (const r of rs || []) { const s = reviewedByUser.get(r.user_id) || new Set<string>(); s.add(r.task_id); reviewedByUser.set(r.user_id, s) }
  }

  // デモデイ参加
  const demoUsers = new Set<string>()
  if (req.demo_day) {
    const { data: cohorts } = await svc.from('cohorts').select('id').eq('course_id', courseId)
    const cohortIds = (cohorts || []).map((c: { id: string }) => c.id)
    if (cohortIds.length) {
      const { data: de } = await svc.from('demo_day_entries').select('user_id').in('cohort_id', cohortIds)
      for (const d of de || []) demoUsers.add(d.user_id)
    }
  }

  // 既存の発行状況
  const { data: existing } = await svc.from('user_certifications').select('user_id, status, certificate_number').eq('certification_id', id)
  const status = new Map<string, { status: string; number: string | null }>()
  for (const e of existing || []) status.set(e.user_id, { status: e.status, number: e.certificate_number })

  const rows = userIds.map((uid) => ({
    uid, name: names.get(uid) || '受講者',
    eligible: certificationEligible({ approvedGradeLevel: maxGrade.get(uid) || 0, reviewedTaskIds: reviewedByUser.get(uid) || new Set(), hasDemoDay: demoUsers.has(uid) }, req),
    st: status.get(uid),
  })).sort((a, b) => Number(b.eligible) - Number(a.eligible))

  return (
    <AdminLayout>
      <div className="mb-4"><Link href="/admin/certifications" className="text-sm text-blue-600 hover:text-blue-700">&larr; 認定の一覧</Link></div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">{cert.name}</h1>
      <p className="text-sm text-gray-500 mb-6">{(cert.course as unknown as { title: string } | null)?.title}／条件: {req.grade_level ? `グレード${req.grade_level}` : ''}{req.demo_day ? '・デモデイ' : ''}</p>

      <div className="space-y-2">
        {rows.map((r) => (
          <Card key={r.uid}><CardBody>
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="font-medium text-gray-900">{r.name}</span>
                {r.st?.status === 'approved'
                  ? <Badge variant="success">発行済み {r.st.number}</Badge>
                  : r.st?.status === 'rejected'
                    ? <Badge variant="danger">差し戻し</Badge>
                    : r.eligible ? <Badge variant="info">条件達成</Badge> : <Badge variant="default">未達</Badge>}
              </div>
              <div className="flex gap-2">
                {r.st?.status !== 'approved' && r.eligible && (
                  <ActionButton endpoint="/api/admin/certifications" body={{ action: 'approve', certificationId: id, userId: r.uid }} label="発行" />
                )}
                {r.st?.status !== 'rejected' && r.st?.status !== 'approved' && (
                  <ActionButton endpoint="/api/admin/certifications" body={{ action: 'reject', certificationId: id, userId: r.uid }} label="差し戻し" variant="ghost" />
                )}
              </div>
            </div>
          </CardBody></Card>
        ))}
        {rows.length === 0 && <Card><CardBody><p className="text-sm text-gray-500">対象の受講者がいません。</p></CardBody></Card>}
      </div>
    </AdminLayout>
  )
}
