import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { certificationEnabled, orgAdminEnabled } from '@/lib/flags'
import { STAFF_ROLES } from '@/lib/review/service'
import { toCsv, RECORD_HEADERS, DEFAULT_MINUTES_PER_SUBMISSION } from '@/lib/review/records'

export async function GET(request: NextRequest) {
  if (!certificationEnabled() && !orgAdminEnabled()) return NextResponse.json({ error: '機能が無効です' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = request.nextUrl.searchParams
  const scope = sp.get('scope') || 'course'
  const svc = await createServiceClient()

  let userIds: string[] = []
  let label = 'records'

  if (scope === 'org') {
    const orgId = sp.get('orgId')
    // 自分が org_admin の組織に限る
    const { data: adminOf } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).eq('role', 'org_admin')
    const myOrgs = new Set((adminOf || []).map((m) => m.organization_id))
    const target = orgId && myOrgs.has(orgId) ? orgId : [...myOrgs][0]
    if (!target) return NextResponse.json({ error: '対象の組織がありません' }, { status: 403 })
    const { data: mem } = await svc.from('organization_members').select('user_id').eq('organization_id', target).eq('role', 'learner')
    userIds = (mem || []).map((m: { user_id: string }) => m.user_id)
    label = 'org'
  } else {
    // コース単位はプラットフォームのスタッフのみ
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (!profile || !STAFF_ROLES.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const courseId = sp.get('courseId')
    if (!courseId) return NextResponse.json({ error: 'courseId が必要です' }, { status: 400 })
    const { data: enr } = await svc.from('enrollments').select('user_id').eq('course_id', courseId).eq('status', 'active')
    userIds = (enr || []).map((e: { user_id: string }) => e.user_id)
    label = 'course'
  }

  if (!userIds.length) return csvResponse(toCsv(RECORD_HEADERS, []), label)

  // 氏名・メール
  const names = new Map<string, string>()
  const { data: profs } = await svc.from('profiles').select('id, name').in('id', userIds)
  for (const p of profs || []) names.set(p.id, p.name || '')
  const emails = new Map<string, string>()
  try {
    const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 })
    for (const u of list?.users || []) if (u.id && u.email) emails.set(u.id, u.email)
  } catch { /* メール取得不可でも続行 */ }

  // 提出（件数・提出日数・添削受領数・学習時間近似）
  const sub = { count: new Map<string, number>(), days: new Map<string, Set<string>>(), reviewed: new Map<string, number>(), minutes: new Map<string, number>() }
  const { data: subs } = await svc.from('review_submissions')
    .select('user_id, learning_day, status, task:review_tasks(estimated_minutes)').in('user_id', userIds).neq('status', 'draft')
  for (const s of subs || []) {
    sub.count.set(s.user_id, (sub.count.get(s.user_id) || 0) + 1)
    const d = sub.days.get(s.user_id) || new Set<string>(); if (s.learning_day) d.add(s.learning_day); sub.days.set(s.user_id, d)
    if (s.status === 'reviewed') sub.reviewed.set(s.user_id, (sub.reviewed.get(s.user_id) || 0) + 1)
    const est = (s.task as unknown as { estimated_minutes: number | null } | null)?.estimated_minutes || DEFAULT_MINUTES_PER_SUBMISSION
    sub.minutes.set(s.user_id, (sub.minutes.get(s.user_id) || 0) + est)
  }

  // グレード最高段階
  const { data: grades } = await svc.from('grades').select('id, level')
  const gl = new Map<string, number>((grades || []).map((g: { id: string; level: number }) => [g.id, g.level]))
  const { data: ug } = await svc.from('user_grades').select('user_id, grade_id').eq('status', 'approved').in('user_id', userIds)
  const maxGrade = new Map<string, number>()
  for (const g of ug || []) maxGrade.set(g.user_id, Math.max(maxGrade.get(g.user_id) || 0, gl.get(g.grade_id) || 0))

  // 認定（数・最新）
  const { data: uc } = await svc.from('user_certifications').select('user_id, certificate_number, issued_at').eq('status', 'approved').in('user_id', userIds).order('issued_at', { ascending: false })
  const certCount = new Map<string, number>()
  const latestCert = new Map<string, { number: string | null; issued: string | null }>()
  for (const c of uc || []) {
    certCount.set(c.user_id, (certCount.get(c.user_id) || 0) + 1)
    if (!latestCert.has(c.user_id)) latestCert.set(c.user_id, { number: c.certificate_number, issued: c.issued_at })
  }

  const rows = userIds.map((uid) => {
    const lc = latestCert.get(uid)
    return [
      names.get(uid) || '', emails.get(uid) || '',
      sub.count.get(uid) || 0, sub.days.get(uid)?.size || 0, sub.reviewed.get(uid) || 0,
      sub.minutes.get(uid) || 0, maxGrade.get(uid) || 0, certCount.get(uid) || 0,
      lc?.number || '', lc?.issued ? new Date(lc.issued).toISOString().slice(0, 10) : '',
    ]
  })

  return csvResponse(toCsv(RECORD_HEADERS, rows), label)
}

function csvResponse(csv: string, label: string): Response {
  const date = new Date().toISOString().slice(0, 10)
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="learning-records-${label}-${date}.csv"`,
    },
  })
}
