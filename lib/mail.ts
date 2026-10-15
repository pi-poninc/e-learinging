/**
 * メール送信（Resend）。既存の admin/reminders と同じ仕組みを1か所に集約。
 * RESEND_API_KEY 未設定なら送らず { ok:false } を返す（例外は投げない）。
 */
export async function sendEmail(opts: { to: string; subject: string; text: string }): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.REMINDER_FROM || 'onboarding@resend.dev'
  if (!key) return { ok: false, error: 'RESEND_API_KEY 未設定' }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, text: opts.text }),
    })
    if (res.ok) return { ok: true }
    const body = await res.json().catch(() => null)
    return { ok: false, error: body?.message || String(res.status) }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
