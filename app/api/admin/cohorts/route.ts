import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cohortEnabled } from '@/lib/flags'
import { STAFF_ROLES } from '@/lib/review/service'

export async function POST(request: NextRequest) {
  if (!cohortEnabled()) return NextResponse.json({ error: '機能が無効です' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF_ROLES.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { action } = body

  if (action === 'create') {
    const { courseId, name, startDate, endDate, demoDayAt } = body
    if (!courseId || !name) return NextResponse.json({ error: 'courseId と name が必要です' }, { status: 400 })
    const { data, error } = await supabase.from('cohorts').insert({
      course_id: courseId, name, start_date: startDate || null, end_date: endDate || null, demo_day_at: demoDayAt || null,
    }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: data.id })
  }

  if (action === 'add_member') {
    const { cohortId, userId, role } = body
    if (!cohortId || !userId) return NextResponse.json({ error: 'cohortId と userId が必要です' }, { status: 400 })
    const { error } = await supabase.from('cohort_members').upsert(
      { cohort_id: cohortId, user_id: userId, role: role === 'mentor' ? 'mentor' : 'learner' },
      { onConflict: 'cohort_id,user_id' },
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'remove_member') {
    const { cohortId, userId } = body
    const { error } = await supabase.from('cohort_members').delete().eq('cohort_id', cohortId).eq('user_id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: '不明なaction' }, { status: 400 })
}
