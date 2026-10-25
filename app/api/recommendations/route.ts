import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { recommendNextCourses, type PathLite, type CompletionMap } from '@/lib/recommend-courses'
import { computeLevel } from '@/lib/fde-level'

/**
 * 講座レコメンド API。
 * - ログインユーザー本人の「次におすすめ」を返す（既定）。
 * - スタッフは ?userId= で他ユーザー分も取得可。
 * - 社内イントラ等の外部連携用に、INTRANET_API_TOKEN の Bearer でも ?userId= を許可
 *   （cookie不要・サーバ間連携向け。/api は middleware 対象外）。
 *
 * レスポンス: { userId, recommendations: [{ courseId, title, reason, pathTitle, url }] }
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const qsUser = request.nextUrl.searchParams.get('userId')
  const qsEmail = request.nextUrl.searchParams.get('email')
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 3, 10)

  // email → e-learning のユーザーID を解決（イントラは社員をメールで識別するため）
  async function resolveEmail(email: string): Promise<string | null> {
    const svc = await createServiceClient()
    const target = email.trim().toLowerCase()
    // auth ユーザーをページングで突き合わせ（最大数千件を想定）
    for (let page = 1; page <= 10; page++) {
      const { data } = await svc.auth.admin.listUsers({ page, perPage: 1000 })
      const users = data?.users || []
      const hit = users.find((u) => (u.email || '').toLowerCase() === target)
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

  // 他ユーザー（userId/email）の指定を許すのは、イントラトークン or スタッフのみ
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

  // --- 完了データ ---
  const [pr, qa, ca, as_] = await Promise.all([
    svc.from('lesson_progress').select('lesson_id').eq('user_id', targetUser).eq('completed', true),
    svc.from('quiz_attempts').select('quiz_id').eq('user_id', targetUser).eq('passed', true),
    svc.from('case_attempts').select('case_simulation_id').eq('user_id', targetUser).eq('completed', true),
    svc.from('assignment_submissions').select('assignment_id').eq('user_id', targetUser).eq('status', 'approved'),
  ])
  const doneL = new Set((pr.data || []).map((r) => r.lesson_id))
  const doneQ = new Set((qa.data || []).map((r) => r.quiz_id))
  const doneC = new Set((ca.data || []).map((r) => r.case_simulation_id))
  const doneA = new Set((as_.data || []).map((r) => r.assignment_id))

  // --- パス＋項目 ---
  const { data: paths } = await svc.from('learning_paths').select('id, title').eq('status', 'published').order('sort_order')
  const pathIds = (paths || []).map((p) => p.id)
  const { data: items } = pathIds.length
    ? await svc.from('path_items').select('path_id, course_id, sort_order, milestone_label, course:courses(id, title, status)').in('path_id', pathIds)
    : { data: [] }

  const titleById: Record<string, string> = {}
  const publishedCourse = new Set<string>()
  for (const it of items || []) {
    const c = it.course as unknown as { id: string; title: string; status: string } | null
    if (c) {
      titleById[it.course_id] = c.title
      if (c.status === 'published') publishedCourse.add(it.course_id)
    }
  }

  // --- 対象講座の完了率 ---
  const courseIds = Array.from(new Set((items || []).map((it) => it.course_id)))
  const completion: CompletionMap = {}
  courseIds.forEach((c) => (completion[c] = { total: 0, done: 0 }))
  if (courseIds.length) {
    const { data: sections } = await svc.from('sections').select('id, course_id').in('course_id', courseIds)
    const secToCourse = new Map((sections || []).map((s) => [s.id, s.course_id]))
    const secIds = (sections || []).map((s) => s.id)
    if (secIds.length) {
      const [ls, qs, as2, cs] = await Promise.all([
        svc.from('lessons').select('id, section_id').eq('status', 'published').in('section_id', secIds),
        svc.from('quizzes').select('id, section_id').eq('status', 'published').in('section_id', secIds),
        svc.from('assignments').select('id, section_id').eq('status', 'published').in('section_id', secIds),
        svc.from('case_simulations').select('id, section_id').eq('status', 'published').in('section_id', secIds),
      ])
      const bump = (secId: string, done: boolean) => {
        const cid = secToCourse.get(secId); if (!cid) return
        const cp = completion[cid]; if (!cp) return
        cp.total += 1; if (done) cp.done += 1
      }
      for (const l of ls.data || []) bump(l.section_id, doneL.has(l.id))
      for (const q of qs.data || []) bump(q.section_id, doneQ.has(q.id))
      for (const a of as2.data || []) bump(a.section_id, doneA.has(a.id))
      for (const c of cs.data || []) bump(c.section_id, doneC.has(c.id))
    }
  }

  const pathsLite: PathLite[] = (paths || []).map((p) => ({
    id: p.id, title: p.title,
    items: (items || [])
      .filter((it) => it.path_id === p.id && publishedCourse.has(it.course_id))
      .map((it) => ({ courseId: it.course_id, sortOrder: it.sort_order, milestone: it.milestone_label })),
  }))

  const recos = recommendNextCourses(pathsLite, completion, titleById, limit)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin

  // --- 学習状況サマリ（レベル・王道進捗・次の一歩）---
  const { data: prof } = await svc.from('profiles').select('name').eq('id', targetUser).maybeSingle()
  const level = computeLevel({ lessons: doneL.size, quizzes: doneQ.size, cases: doneC.size, assignments: doneA.size })

  const master = pathsLite.find((p) => p.title.startsWith('pipon流の働き方'))
  let masterPath: null | { title: string; overallPct: number; nextCourse: { courseId: string; title: string; url: string } | null } = null
  if (master) {
    let tot = 0, dn = 0
    for (const it of master.items) {
      const cp = completion[it.courseId]; if (!cp) continue
      tot += cp.total; dn += cp.done
    }
    const ordered = [...master.items].sort((a, b) => a.sortOrder - b.sortOrder)
    const firstIncomplete = ordered.find((it) => {
      const cp = completion[it.courseId]
      return !(cp && cp.total > 0 && cp.done >= cp.total)
    })
    masterPath = {
      title: master.title.replace('【まずここから】', ''),
      overallPct: tot ? Math.round((dn / tot) * 100) : 0,
      nextCourse: firstIncomplete
        ? { courseId: firstIncomplete.courseId, title: titleById[firstIncomplete.courseId] || '(講座)', url: `${appUrl}/courses/${firstIncomplete.courseId}` }
        : null,
    }
  }

  return NextResponse.json({
    userId: targetUser,
    learner: {
      name: prof?.name || null,
      level: { level: level.level, title: level.title, xp: level.xp },
      masterPath,
    },
    recommendations: recos.map((r) => ({
      courseId: r.courseId, title: r.title, reason: r.reason,
      pathTitle: r.pathTitle, url: `${appUrl}/courses/${r.courseId}`,
    })),
  })
}
