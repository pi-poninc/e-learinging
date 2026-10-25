import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { computeLearnerSummary } from '@/lib/learner-summary'

/**
 * 講座レコメンド API。
 * - ログインユーザー本人の「次におすすめ」＋学習状況を返す（既定）。
 * - スタッフは ?userId= / ?email= で他ユーザー分も取得可。
 * - 社内イントラ等の外部連携用に、INTRANET_API_TOKEN の Bearer でも ?userId=/?email= を許可
 *   （cookie不要・サーバ間連携向け。/api は middleware 対象外）。
 *
 * レスポンス: { userId, learner:{name,level,masterPath}, recommendations:[...] }
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const qsUser = request.nextUrl.searchParams.get('userId')
  const qsEmail = request.nextUrl.searchParams.get('email')
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 3, 10)

  async function resolveEmail(email: string): Promise<string | null> {
    const svc = await createServiceClient()
    const target = email.trim().toLowerCase()
    for (let page = 1; page <= 10; page++) {
      const { data } = await svc.auth.admin.listUsers({ page, perPage: 1000 })
      const users = data?.users || []
      const hit = users.find((u: { email?: string }) => (u.email || '').toLowerCase() === target)
      if (hit) return hit.id
      if (users.length < 1000) break
    }
    return null
  }

  // --- 認証：イントラトークン or ログイン ---
  const intranetToken = process.env.INTRANET_API_TOKEN
  const authz = request.headers.get('authorization') || ''
  const bearer = authz.startsWith('Bearer ') ? authz.slice(7) : ''
  const viaToken = !!intranetToken && bearer === intranetToken

  let allowOther = viaToken
  let selfId = ''
  if (!viaToken) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    selfId = user.id
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    allowOther = !!profile && ['admin', 'instructor', 'manager'].includes(profile.role)
  }

  let targetUser = ''
  if (qsEmail) {
    if (!allowOther) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const resolved = await resolveEmail(qsEmail)
    if (!resolved) return NextResponse.json({ error: 'User not found for email', recommendations: [] }, { status: 404 })
    targetUser = resolved
  } else if (qsUser) {
    if (!allowOther && qsUser !== selfId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    targetUser = qsUser
  } else {
    targetUser = selfId
  }
  if (!targetUser) return NextResponse.json({ error: 'Missing userId or email' }, { status: 400 })

  const svc = await createServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
  const summary = await computeLearnerSummary(svc, targetUser, appUrl, limit)

  return NextResponse.json({
    userId: targetUser,
    learner: { name: summary.name, level: summary.level, masterPath: summary.masterPath },
    recommendations: summary.recommendations,
  })
}
