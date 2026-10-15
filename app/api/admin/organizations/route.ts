import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { orgAdminEnabled } from '@/lib/flags'
import { STAFF_ROLES } from '@/lib/review/service'

export async function POST(request: NextRequest) {
  if (!orgAdminEnabled()) return NextResponse.json({ error: '機能が無効です' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF_ROLES.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { action } = body

  if (action === 'create') {
    const { name, plan, contractStart, contractEnd } = body
    if (!name) return NextResponse.json({ error: 'name が必要です' }, { status: 400 })
    const { data, error } = await supabase.from('organizations').insert({
      name, plan: plan || null, contract_start: contractStart || null, contract_end: contractEnd || null,
    }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: data.id })
  }

  if (action === 'add_member') {
    const { organizationId, userId, role } = body
    if (!organizationId || !userId) return NextResponse.json({ error: 'organizationId と userId が必要です' }, { status: 400 })
    const { error } = await supabase.from('organization_members').upsert(
      { organization_id: organizationId, user_id: userId, role: role === 'org_admin' ? 'org_admin' : 'learner' },
      { onConflict: 'organization_id,user_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'remove_member') {
    const { organizationId, userId } = body
    const { error } = await supabase.from('organization_members').delete().eq('organization_id', organizationId).eq('user_id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'set_contract') {
    const { organizationId, showSubmissionContent, showCoachLogs } = body
    const patch: Record<string, boolean> = {}
    if (typeof showSubmissionContent === 'boolean') patch.show_submission_content = showSubmissionContent
    if (typeof showCoachLogs === 'boolean') patch.show_coach_logs = showCoachLogs
    const { error } = await supabase.from('organizations').update(patch).eq('id', organizationId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: '不明なaction' }, { status: 400 })
}
