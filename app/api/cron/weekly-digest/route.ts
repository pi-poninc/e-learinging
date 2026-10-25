import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { computeLearnerSummary } from '@/lib/learner-summary'
import { sendEmail } from '@/lib/mail'

/**
 * 週次学習ダイジェスト。受講中のユーザーへ「レベル・王道進捗・次の1本・おすすめ」をメール。
 * CRON_SECRET の Bearer で保護（/api は middleware 対象外）。Render Cron で毎週叩く想定。
 * RESEND_API_KEY 未設定なら送らず集計のみ返す（無害）。
 */
export const dynamic = 'force-dynamic'

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : header
  const q = request.nextUrl.searchParams.get('token')
  return token === secret || q === secret
}

async function run(request: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET 未設定' }, { status: 503 })
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = await createServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin

  // 受講中のユーザー（active enrollment が1件以上）
  const { data: enr } = await svc.from('enrollments').select('user_id').eq('status', 'active')
  const userIds = Array.from(new Set((enr || []).map((e: { user_id: string }) => e.user_id)))
  if (userIds.length === 0) return NextResponse.json({ sent: 0, total: 0, note: '対象なし' })

  // メール取得
  const emailById: Record<string, string> = {}
  for (let page = 1; page <= 10; page++) {
    const { data } = await svc.auth.admin.listUsers({ page, perPage: 1000 })
    for (const u of data?.users || []) emailById[u.id] = u.email || ''
    if ((data?.users || []).length < 1000) break
  }

  const key = process.env.RESEND_API_KEY
  let sent = 0
  const errors: string[] = []

  for (const uid of userIds) {
    const email = emailById[uid]
    if (!email) continue
    let summary
    try {
      summary = await computeLearnerSummary(svc, uid, appUrl, 3)
    } catch (e) {
      errors.push(`${email}: ${(e as Error).message}`); continue
    }
    const name = summary.name || 'さん'
    const mp = summary.masterPath
    const lines: string[] = []
    lines.push(`${summary.name ? summary.name + ' さん' : name}、今週の学習ダイジェストです。`)
    lines.push('')
    lines.push(`■ あなたのレベル：Lv.${summary.level.level}（${summary.level.title}）`)
    if (mp) {
      lines.push(`■ 王道ジャーニー：${mp.overallPct}% 完了`)
      if (mp.nextCourse) lines.push(`　次の1本 → ${mp.nextCourse.title}\n　${mp.nextCourse.url}`)
    }
    if (summary.recommendations.length) {
      lines.push('')
      lines.push('■ 次におすすめの講座')
      for (const r of summary.recommendations) lines.push(`・${r.title}（${r.reason}）\n　${r.url}`)
    }
    lines.push('')
    lines.push(`マイページ：${appUrl}/dashboard`)
    const text = lines.join('\n')

    if (!key) continue // 送信はスキップ（集計のみ）
    const res = await sendEmail({ to: email, subject: '【pipon learning】今週の学習ダイジェスト', text })
    if (res.ok) sent++
    else errors.push(`${email}: ${res.error}`)
  }

  return NextResponse.json({
    sent, total: userIds.length, emailConfigured: !!key,
    note: key ? undefined : 'RESEND_API_KEY 未設定のため送信していません（集計のみ）',
    errors: errors.length ? errors : undefined,
    ranAt: new Date().toISOString(),
  })
}

export async function GET(request: NextRequest) { return run(request) }
export async function POST(request: NextRequest) { return run(request) }
