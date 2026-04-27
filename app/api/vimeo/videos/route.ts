import { createClient } from '@/lib/supabase/server'
import { listVimeoVideos } from '@/lib/vimeo'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Admin only
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['admin', 'instructor'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const page = parseInt(request.nextUrl.searchParams.get('page') || '1')
  const result = await listVimeoVideos(page)

  if (!result) {
    return NextResponse.json(
      { error: 'Vimeo APIに接続できません。VIMEO_ACCESS_TOKENを確認してください。' },
      { status: 500 }
    )
  }

  return NextResponse.json(result)
}
