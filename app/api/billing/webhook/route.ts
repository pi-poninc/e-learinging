import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyWebhookSignature } from '@/lib/billing'

/**
 * Stripe Webhook。checkout.session.completed を受けて購入履歴を記録し、受講登録する。
 * 署名検証は STRIPE_WEBHOOK_SECRET で行う（/api は middleware 対象外）。
 * 冪等性: stripe_session_id を unique にしており、二重配信は onConflict で無視。
 */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const raw = await request.text()
  const sig = request.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!verifyWebhookSignature(raw, sig, secret)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } }
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true, ignored: event.type })
  }

  const session = event.data?.object || {}
  const meta = (session.metadata as Record<string, string>) || {}
  const courseId = meta.course_id
  const userId = meta.user_id || (session.client_reference_id as string)
  const amount = Number(session.amount_total ?? 0)
  const sessionId = session.id as string
  const paymentIntent = (session.payment_intent as string) || null
  if (!courseId || !userId) {
    return NextResponse.json({ error: 'missing metadata' }, { status: 400 })
  }

  const svc = await createServiceClient()

  // 購入履歴（session_id で冪等化）
  const { error: purErr } = await svc
    .from('course_purchases')
    .upsert(
      {
        user_id: userId, course_id: courseId, amount_jpy: amount,
        status: 'paid', stripe_session_id: sessionId, stripe_payment_intent: paymentIntent,
      },
      { onConflict: 'stripe_session_id', ignoreDuplicates: true },
    )
  if (purErr) return NextResponse.json({ error: purErr.message }, { status: 500 })

  // 受講登録（無ければ作る）
  const { data: enr } = await svc
    .from('enrollments').select('id, status').eq('user_id', userId).eq('course_id', courseId).maybeSingle()
  if (!enr) {
    await svc.from('enrollments').insert({ user_id: userId, course_id: courseId, status: 'active' })
  } else if (enr.status !== 'active') {
    await svc.from('enrollments').update({ status: 'active' }).eq('id', enr.id)
  }

  return NextResponse.json({ received: true })
}
