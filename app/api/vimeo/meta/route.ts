import { createClient } from '@/lib/supabase/server'
import { fetchVimeoVideo, extractVimeoId } from '@/lib/vimeo'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['admin', 'instructor'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const videoUrl = request.nextUrl.searchParams.get('url')
  if (!videoUrl) return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })

  const videoId = extractVimeoId(videoUrl)
  if (!videoId) return NextResponse.json({ error: 'Invalid Vimeo URL' }, { status: 400 })

  const meta = await fetchVimeoVideo(videoId)
  if (!meta) {
    return NextResponse.json(
      { error: 'Vimeo動画が見つかりません。URLまたはアクセストークンを確認してください。' },
      { status: 404 }
    )
  }

  return NextResponse.json({ videoId, ...meta })
}
