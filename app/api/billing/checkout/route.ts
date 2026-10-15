import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { billingEnabled } from '@/lib/flags'
import { createCheckoutSession, isPaid } from '@/lib/billing'

/** POST /api/billing/checkout { courseId } → { url } Stripe Checkout へ誘導。 */
export async function POST(request: NextRequest) {
  if (!billingEnabled()) return NextResponse.json({ error: '決済は無効です' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId } = await request.json().catch(() => ({ courseId: null }))
  if (!courseId) return NextResponse.json({ error: 'courseId が必要です' }, { status: 400 })

  const svc = await createServiceClient()
  const { data: course } = await svc
    .from('courses')
    .select('id, title, price_jpy, status')
    .eq('id', courseId)
    .maybeSingle()
  if (!course || course.status !== 'published') {
    return NextResponse.json({ error: '講座が見つかりません' }, { status: 404 })
  }
  if (!isPaid(course.price_jpy)) {
    return NextResponse.json({ error: 'この講座は有料ではありません' }, { status: 400 })
  }

  // 既に受講中なら購入不要
  const { data: enr } = await svc
    .from('enrollments').select('id').eq('user_id', user.id).eq('course_id', courseId)
    .eq('status', 'active').maybeSingle()
  if (enr) return NextResponse.json({ error: '既に受講中です' }, { status: 409 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
  const result = await createCheckoutSession({
    courseId: course.id,
    courseTitle: course.title,
    amountJpy: course.price_jpy as number,
    userId: user.id,
    userEmail: user.email || '',
    successUrl: `${appUrl}/courses/${course.id}`,
    cancelUrl: `${appUrl}/store`,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })
  return NextResponse.json({ url: result.url })
}
