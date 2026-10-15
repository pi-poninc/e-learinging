/**
 * 決済（Stripe 買い切り / Checkout）。
 * lib/mail.ts と同じく SDK を足さず REST(fetch) + node:crypto で実装する（依存を増やさない）。
 * 署名検証は Stripe の仕様（t=... , v1=... ／ signed_payload = `${t}.${rawBody}`）に従う。
 */
import crypto from 'node:crypto'

/** 価格を「¥1,980」形式に整形。null/0 は「無料」。純関数（テスト対象）。 */
export function formatPriceJpy(price: number | null | undefined): string {
  if (!price || price <= 0) return '無料'
  return '¥' + price.toLocaleString('ja-JP')
}

/** 有料講座か（価格が正の整数）。 */
export function isPaid(price: number | null | undefined): boolean {
  return typeof price === 'number' && price > 0
}

export interface CheckoutParams {
  courseId: string
  courseTitle: string
  amountJpy: number
  userId: string
  userEmail: string
  successUrl: string
  cancelUrl: string
}

/**
 * Stripe Checkout セッションを作成し、決済ページURLを返す。
 * STRIPE_SECRET_KEY 未設定なら { ok:false }。例外は投げない。
 */
export async function createCheckoutSession(
  p: CheckoutParams,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return { ok: false, error: 'STRIPE_SECRET_KEY 未設定' }

  // application/x-www-form-urlencoded（Stripe REST はフォーム形式）
  const form = new URLSearchParams()
  form.set('mode', 'payment')
  form.set('success_url', p.successUrl)
  form.set('cancel_url', p.cancelUrl)
  form.set('customer_email', p.userEmail)
  form.set('client_reference_id', p.userId)
  form.set('line_items[0][quantity]', '1')
  form.set('line_items[0][price_data][currency]', 'jpy')
  form.set('line_items[0][price_data][unit_amount]', String(p.amountJpy)) // JPY はゼロ桁通貨＝そのまま円
  form.set('line_items[0][price_data][product_data][name]', p.courseTitle)
  form.set('metadata[course_id]', p.courseId)
  form.set('metadata[user_id]', p.userId)

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    const body = await res.json().catch(() => null)
    if (res.ok && body?.url) return { ok: true, url: body.url as string }
    return { ok: false, error: body?.error?.message || `Stripe ${res.status}` }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/**
 * Stripe Webhook 署名を検証する純関数。
 * header 例: `t=1600000000,v1=hexsig`。許容誤差は既定5分。
 * 成功時 true。secret や header、鮮度、署名のいずれかが不正なら false。
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined,
  toleranceSec = 300,
  nowSec: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !signatureHeader) return false
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const i = kv.indexOf('=')
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()]
    }),
  ) as Record<string, string>
  const t = parts['t']
  const v1 = parts['v1']
  if (!t || !v1) return false
  if (Math.abs(nowSec - Number(t)) > toleranceSec) return false

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${t}.${rawBody}`, 'utf8')
    .digest('hex')
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(v1, 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
