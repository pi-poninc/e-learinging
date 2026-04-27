import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { lessonId } = body

  if (!lessonId) {
    return NextResponse.json({ error: 'Missing lessonId' }, { status: 400 })
  }

  // Verify access
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (profile.role === 'student') {
    const { data: lesson } = await supabase
      .from('lessons')
      .select('section:sections!inner(course_id)')
      .eq('id', lessonId)
      .single()

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    const section = lesson.section as unknown as { course_id: string }

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
  }

  // Get existing progress to preserve watched_seconds
  const { data: existing } = await supabase
    .from('lesson_progress')
    .select('watched_seconds')
    .eq('user_id', user.id)
    .eq('lesson_id', lessonId)
    .maybeSingle()

  const { error } = await supabase
    .from('lesson_progress')
    .upsert(
      {
        user_id: user.id,
        lesson_id: lessonId,
        watched_seconds: existing?.watched_seconds || 0,
        completed: true,
        completed_at: new Date().toISOString(),
        progress_rate: 1,
      },
      { onConflict: 'user_id,lesson_id' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
