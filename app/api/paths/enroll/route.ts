import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pathId } = await request.json()
  if (!pathId) return NextResponse.json({ error: 'Missing pathId' }, { status: 400 })

  // 既に開始していれば started_at は維持（upsert で衝突時は何もしない）
  const { data: existing } = await supabase
    .from('path_enrollments').select('id').eq('user_id', user.id).eq('path_id', pathId).maybeSingle()
  if (existing) return NextResponse.json({ success: true, already: true })

  const { error } = await supabase.from('path_enrollments').insert({
    user_id: user.id, path_id: pathId, status: 'active',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
