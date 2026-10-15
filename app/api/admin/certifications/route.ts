import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { certificationEnabled } from '@/lib/flags'
import { STAFF_ROLES } from '@/lib/review/service'
import { genCertificateNumber } from '@/lib/review/certification'

export async function POST(request: NextRequest) {
  if (!certificationEnabled()) return NextResponse.json({ error: '機能が無効です' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF_ROLES.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { action } = body

  if (action === 'create') {
    const { courseId, name, requirements, validityMonths } = body
    if (!courseId || !name) return NextResponse.json({ error: 'courseId と name が必要です' }, { status: 400 })
    const { data, error } = await supabase.from('certifications').insert({
      course_id: courseId, name, requirements: requirements || {}, validity_months: validityMonths || null,
    }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: data.id })
  }

  if (action === 'approve') {
    const { certificationId, userId, evidence } = body
    if (!certificationId || !userId) return NextResponse.json({ error: 'certificationId と userId が必要です' }, { status: 400 })
    const { data: cert } = await supabase.from('certifications').select('validity_months').eq('id', certificationId).maybeSingle()
    if (!cert) return NextResponse.json({ error: '認定が見つかりません' }, { status: 404 })
    const now = new Date()
    const expiresAt = cert.validity_months ? new Date(now.getTime() + cert.validity_months * 30 * 24 * 3600 * 1000).toISOString() : null

    // 採番（衝突時は数回リトライ）
    let number = ''
    let ok = false
    for (let i = 0; i < 5 && !ok; i++) {
      number = genCertificateNumber(now)
      const { error } = await supabase.from('user_certifications').upsert({
        user_id: userId, certification_id: certificationId, status: 'approved',
        certificate_number: number, issued_at: now.toISOString(), expires_at: expiresAt,
        evidence: evidence || {}, approved_by: user.id,
      }, { onConflict: 'user_id,certification_id' })
      if (!error) ok = true
      else if ((error as { code?: string }).code !== '23505') return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!ok) return NextResponse.json({ error: '採番に失敗しました' }, { status: 500 })

    await supabase.from('learning_events').insert({ user_id: userId, event_name: 'certification_issued', properties: { certification_id: certificationId, number } })
    return NextResponse.json({ ok: true, number })
  }

  if (action === 'reject') {
    const { certificationId, userId } = body
    const { error } = await supabase.from('user_certifications').upsert({
      user_id: userId, certification_id: certificationId, status: 'rejected',
    }, { onConflict: 'user_id,certification_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: '不明なaction' }, { status: 400 })
}
