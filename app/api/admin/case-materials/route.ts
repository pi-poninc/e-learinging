import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { skillMapEnabled } from '@/lib/flags'
import { STAFF_ROLES } from '@/lib/review/service'

export async function POST(request: NextRequest) {
  if (!skillMapEnabled()) return NextResponse.json({ error: '機能が無効です' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { action } = body

  if (action === 'create') {
    const { title, background, courseId, modelAnswer, sourceNote } = body
    if (!title) return NextResponse.json({ error: 'title が必要です' }, { status: 400 })
    const { data: cm, error } = await supabase
      .from('case_materials').insert({ title, background: background || null, course_id: courseId || null }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (modelAnswer || sourceNote) {
      await supabase.from('case_material_private').insert({ case_material_id: cm.id, model_answer: modelAnswer || null, source_project_note: sourceNote || null })
    }
    return NextResponse.json({ id: cm.id })
  }

  if (action === 'approve') {
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })
    const { error } = await supabase
      .from('case_materials').update({ anonymization_status: 'approved', anonymization_reviewed_by: user.id }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await supabase.from('learning_events').insert({ user_id: user.id, event_name: 'case_material_approved', properties: { case_material_id: id } })
    return NextResponse.json({ ok: true })
  }

  if (action === 'revert') {
    const { id } = body
    const { error } = await supabase.from('case_materials').update({ anonymization_status: 'draft' }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: '不明なaction' }, { status: 400 })
}
