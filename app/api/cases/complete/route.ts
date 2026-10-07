import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { caseId, pathTaken, score, total } = body as {
    caseId?: string; pathTaken?: number[]; score?: number; total?: number
  }

  if (!caseId) {
    return NextResponse.json({ error: 'Missing caseId' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Admins/instructors preview without recording completion
  if (['admin', 'instructor'].includes(profile.role)) {
    return NextResponse.json({ success: true, recorded: false })
  }

  // Verify enrollment for students
  const { data: sim } = await supabase
    .from('case_simulations')
    .select('section:sections!inner(course_id)')
    .eq('id', caseId)
    .single()

  if (!sim) {
    return NextResponse.json({ error: 'Case simulation not found' }, { status: 404 })
  }

  const section = sim.section as unknown as { course_id: string }

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', section.course_id)
    .eq('status', 'active')
    .single()

  if (!enrollment) {
    return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })
  }

  const { error } = await supabase
    .from('case_attempts')
    .upsert(
      {
        user_id: user.id,
        case_simulation_id: caseId,
        completed: true,
        path_taken: Array.isArray(pathTaken) ? pathTaken : [],
        score: typeof score === 'number' ? score : 0,
        total: typeof total === 'number' ? total : 0,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,case_simulation_id' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, recorded: true })
}
