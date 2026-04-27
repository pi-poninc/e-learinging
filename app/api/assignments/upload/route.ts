import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const assignmentId = formData.get('assignmentId') as string
  const file = formData.get('file') as File
  const comment = formData.get('comment') as string | null

  if (!assignmentId || !file) {
    return NextResponse.json({ error: 'Missing assignmentId or file' }, { status: 400 })
  }

  // Get assignment info
  const { data: assignment } = await supabase
    .from('assignments')
    .select('*, section:sections(course_id)')
    .eq('id', assignmentId)
    .single()

  if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

  // Check file size
  const maxBytes = (assignment.max_file_size_mb || 10) * 1024 * 1024
  if (file.size > maxBytes) {
    return NextResponse.json({ error: `ファイルサイズが上限(${assignment.max_file_size_mb}MB)を超えています` }, { status: 400 })
  }

  // Check file type
  const ext = file.name.split('.').pop()?.toLowerCase()
  const allowed = assignment.allowed_file_types as string[]
  if (ext && allowed.length > 0 && !allowed.includes(ext)) {
    return NextResponse.json({ error: `許可されていないファイル形式です (${allowed.join(', ')})` }, { status: 400 })
  }

  // Upload to Supabase Storage
  const filePath = `${user.id}/${assignmentId}/${Date.now()}_${file.name}`
  const { error: uploadError } = await supabase.storage
    .from('assignment-files')
    .upload(filePath, file)

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = supabase.storage
    .from('assignment-files')
    .getPublicUrl(filePath)

  // Upsert submission
  const { data: submission, error: subError } = await supabase
    .from('assignment_submissions')
    .upsert({
      user_id: user.id,
      assignment_id: assignmentId,
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_size_bytes: file.size,
      comment: comment || null,
      status: 'submitted',
      grade: null,
      feedback: null,
      submitted_at: new Date().toISOString(),
      reviewed_at: null,
    }, { onConflict: 'user_id,assignment_id' })
    .select()
    .single()

  if (subError) {
    return NextResponse.json({ error: subError.message }, { status: 500 })
  }

  return NextResponse.json({ submission })
}
