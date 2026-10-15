/**
 * リマインド（受講期限）ロジック。
 * admin/reminders（手動送信）と cron/reminders（自動送信）の両方から使う共通部分を集約。
 * 送信は RESEND_API_KEY がある時だけ実行し、無ければ集計のみ（例外は投げない）。
 *
 * サーバクライアントは関数内で遅延 import する（純関数 buildReminderMessage を
 * next/headers 非依存で単体テストできるようにするため。本番の挙動は不変）。
 */

export interface ReminderTarget {
  enrollmentId: string
  email: string
  name: string
  courseTitle: string
  dueDate: string
  overdue: boolean
  source: 'course' | 'path'
}

// 期限切れ or 期限が近い(既定3日)未修了の受講を抽出
export async function collectTargets(withinDays = 3): Promise<ReminderTarget[]> {
  const { createServiceClient } = await import('@/lib/supabase/server')
  const svc = await createServiceClient()
  const today = new Date()
  const limit = new Date(today)
  limit.setDate(limit.getDate() + withinDays)
  const limitStr = limit.toISOString().slice(0, 10)

  const { data: enrollments } = await svc
    .from('enrollments')
    .select('id, due_date, user_id, status, course:courses(title)')
    .eq('status', 'active')
    .not('due_date', 'is', null)
    .lte('due_date', limitStr)

  // メールアドレスを引く（auth）
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const emailById: Record<string, string> = {}
  const nameById: Record<string, string> = {}
  for (const u of list?.users || []) {
    emailById[u.id] = u.email || ''
    nameById[u.id] = (u.user_metadata?.name as string) || u.email || ''
  }

  const todayStr = today.toISOString().slice(0, 10)
  const courseTargets = (enrollments || []).map((e): ReminderTarget => {
    const course = e.course as unknown as { title: string } | null
    const overdue = (e.due_date as string) < todayStr
    return {
      enrollmentId: e.id,
      email: emailById[e.user_id] || '',
      name: nameById[e.user_id] || '',
      courseTitle: course?.title || '',
      dueDate: e.due_date as string,
      overdue,
      source: 'course',
    }
  }).filter((t) => t.email)

  const pathTargets = await collectPathTargets(limitStr, todayStr, emailById, nameById)
  return [...courseTargets, ...pathTargets]
}

// 学習ロードマップの目標日（開始+target_days）に基づく未修了の受講を抽出
async function collectPathTargets(
  limitStr: string, todayStr: string,
  emailById: Record<string, string>, nameById: Record<string, string>,
): Promise<ReminderTarget[]> {
  const { createServiceClient } = await import('@/lib/supabase/server')
  const svc = await createServiceClient()
  const { data: penr } = await svc.from('path_enrollments')
    .select('user_id, path_id, started_at').eq('status', 'active')
  if (!penr || penr.length === 0) return []

  const pathIds = Array.from(new Set(penr.map((e) => e.path_id)))
  const { data: pubPathRows } = await svc.from('learning_paths').select('id').eq('status', 'published').in('id', pathIds)
  const pubPaths = new Set((pubPathRows || []).map((p) => p.id))

  const { data: items } = await svc.from('path_items')
    .select('path_id, course_id, target_days, milestone_label, course:courses(title)').in('path_id', pathIds)
  const courseIds = Array.from(new Set((items || []).map((i) => i.course_id)))
  if (courseIds.length === 0) return []

  // 各講座の公開アイテム総数 ＋ アイテム→講座マップ
  const { data: sections } = await svc.from('sections').select('id, course_id').in('course_id', courseIds)
  const secToCourse = new Map((sections || []).map((s) => [s.id, s.course_id]))
  const secIds = (sections || []).map((s) => s.id)
  const totalByCourse = new Map<string, number>(); courseIds.forEach((c) => totalByCourse.set(c, 0))
  const lessonCourse = new Map<string, string>(), quizCourse = new Map<string, string>(),
        caseCourse = new Map<string, string>(), asgCourse = new Map<string, string>()
  if (secIds.length) {
    const [ls, qs, as_, cs] = await Promise.all([
      svc.from('lessons').select('id, section_id').eq('status', 'published').in('section_id', secIds),
      svc.from('quizzes').select('id, section_id').eq('status', 'published').in('section_id', secIds),
      svc.from('assignments').select('id, section_id').eq('status', 'published').in('section_id', secIds),
      svc.from('case_simulations').select('id, section_id').eq('status', 'published').in('section_id', secIds),
    ])
    const reg = (rows: { id: string; section_id: string }[] | null, m: Map<string, string>) => {
      for (const r of rows || []) {
        const cid = secToCourse.get(r.section_id); if (!cid) continue
        m.set(r.id, cid); totalByCourse.set(cid, (totalByCourse.get(cid) || 0) + 1)
      }
    }
    reg(ls.data, lessonCourse); reg(qs.data, quizCourse); reg(as_.data, asgCourse); reg(cs.data, caseCourse)
  }

  // ユーザー×講座の完了数
  const [lp, qa, ca, su] = await Promise.all([
    svc.from('lesson_progress').select('user_id, lesson_id').eq('completed', true),
    svc.from('quiz_attempts').select('user_id, quiz_id').eq('passed', true),
    svc.from('case_attempts').select('user_id, case_simulation_id').eq('completed', true),
    svc.from('assignment_submissions').select('user_id, assignment_id').eq('status', 'approved'),
  ])
  const done = new Map<string, number>()
  const addDone = (rows: { user_id: string;[k: string]: string }[] | null, key: string, m: Map<string, string>) => {
    for (const r of rows || []) {
      const cid = m.get(r[key]); if (!cid) continue
      const k = `${r.user_id}|${cid}`; done.set(k, (done.get(k) || 0) + 1)
    }
  }
  addDone(lp.data, 'lesson_id', lessonCourse); addDone(qa.data, 'quiz_id', quizCourse)
  addDone(ca.data, 'case_simulation_id', caseCourse); addDone(su.data, 'assignment_id', asgCourse)

  const DAY = 24 * 60 * 60 * 1000
  const out: ReminderTarget[] = []
  const itemsByPath = new Map<string, typeof items>()
  for (const it of items || []) {
    if (!itemsByPath.has(it.path_id)) itemsByPath.set(it.path_id, [])
    itemsByPath.get(it.path_id)!.push(it)
  }
  for (const e of penr) {
    if (!pubPaths.has(e.path_id)) continue
    const started = new Date(e.started_at as string)
    for (const it of itemsByPath.get(e.path_id) || []) {
      if (it.target_days == null) continue
      const dueStr = new Date(started.getTime() + it.target_days * DAY).toISOString().slice(0, 10)
      if (dueStr > limitStr) continue  // まだ先
      const total = totalByCourse.get(it.course_id) || 0
      const d = done.get(`${e.user_id}|${it.course_id}`) || 0
      if (total > 0 && d >= total) continue  // 既に修了
      const course = it.course as unknown as { title: string } | null
      if (!emailById[e.user_id]) continue
      out.push({
        enrollmentId: `path:${e.path_id}:${it.course_id}:${e.user_id}`,
        email: emailById[e.user_id], name: nameById[e.user_id] || '',
        courseTitle: course?.title || '', dueDate: dueStr, overdue: dueStr < todayStr, source: 'path',
      })
    }
  }
  return out
}

/** 1件分のメール件名・本文を組み立てる（送信とテストの両方から使う純関数）。 */
export function buildReminderMessage(t: ReminderTarget, appUrl: string): { subject: string; text: string } {
  const subject = t.overdue
    ? `【受講期限切れ】「${t.courseTitle}」の受講をお願いします`
    : `【受講期限が近づいています】「${t.courseTitle}」`
  const text =
    `${t.name} さん\n\n` +
    `講座「${t.courseTitle}」の受講期限は ${t.dueDate} です。` +
    `${t.overdue ? '期限を過ぎています。' : 'もうすぐ期限です。'}\n` +
    `まだ修了していないレッスンがあります。以下からご受講ください。\n${appUrl}/dashboard\n`
  return { subject, text }
}

export interface SendResult {
  sent: number
  total: number
  emailConfigured: boolean
  note?: string
  errors?: string[]
}

/** 対象へリマインドメールを送信。RESEND_API_KEY 未設定なら集計のみ返す。 */
export async function sendReminders(targets: ReminderTarget[]): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.REMINDER_FROM || 'onboarding@resend.dev'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  if (!key) {
    return {
      sent: 0, total: targets.length, emailConfigured: false,
      note: 'RESEND_API_KEY が未設定です。メール送信は行われていません（対象のみ集計）。',
    }
  }

  let sent = 0
  const errors: string[] = []
  for (const t of targets) {
    const { subject, text } = buildReminderMessage(t, appUrl)
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: t.email, subject, text }),
      })
      if (res.ok) sent++
      else errors.push(`${t.email}: ${(await res.json().catch(() => null))?.message || res.status}`)
    } catch (e) {
      errors.push(`${t.email}: ${(e as Error).message}`)
    }
  }
  return { sent, total: targets.length, emailConfigured: true, errors }
}
