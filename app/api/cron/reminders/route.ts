import { NextRequest, NextResponse } from 'next/server'
import { collectTargets, sendReminders } from '@/lib/reminders'

/**
 * Cron から叩く受講リマインド自動送信。
 * 認証は CRON_SECRET の Bearer トークン（ログインcookie不要なので /api はmiddleware対象外）。
 * Render Cron Job などから毎日1回呼ぶ想定。CRON_SECRET 未設定なら 503。
 */
export const dynamic = 'force-dynamic'

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : header
  // クエリでも許容（一部スケジューラがヘッダを付けにくいため）
  const q = request.nextUrl.searchParams.get('token')
  return token === secret || q === secret
}

async function run(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET 未設定' }, { status: 503 })
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const withinDays = Number(request.nextUrl.searchParams.get('days')) || 3
  const targets = await collectTargets(withinDays)
  const result = await sendReminders(targets)
  return NextResponse.json({ ...result, ranAt: new Date().toISOString() })
}

export async function GET(request: NextRequest) {
  return run(request)
}

export async function POST(request: NextRequest) {
  return run(request)
}
