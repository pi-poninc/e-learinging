import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { certificationEnabled } from '@/lib/flags'

// 受講者本人が、認定の公開確認ページへの掲載に同意/取消する（public_consent のみ変更）
export async function POST(request: NextRequest) {
  if (!certificationEnabled()) return NextResponse.json({ error: '機能が無効です' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, userCertId, consent } = await request.json()
  if (action !== 'consent' || !userCertId) return NextResponse.json({ error: 'パラメータが不正です' }, { status: 400 })

  // service client で本人の行だけ public_consent を更新（status等は変更させない）
  const svc = await createServiceClient()
  const { data: row } = await svc.from('user_certifications').select('user_id').eq('id', userCertId).maybeSingle()
  if (!row || row.user_id !== user.id) return NextResponse.json({ error: '対象が見つかりません' }, { status: 404 })
  const { error } = await svc.from('user_certifications').update({ public_consent: !!consent }).eq('id', userCertId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
