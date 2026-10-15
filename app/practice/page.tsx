import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/permissions'
import { submissionReviewEnabled, skillMapEnabled } from '@/lib/flags'
import { learningDay } from '@/lib/learning-day'
import { recommendTasks, RecoTask } from '@/lib/review/recommend'
import { StudentLayout } from '@/components/layouts/student-layout'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const TYPE_LABEL: Record<string, string> = {
  drill: '基礎ドリル', case: 'ケース課題', timed_challenge: '時間制限課題', ojt: 'OJT', peer_review: 'ピアレビュー',
}

interface TaskRow {
  id: string; course_id: string; title: string; estimated_minutes: number | null
  assignment_type: string; difficulty_level: number | null
  target_skill_ids: string[]; prerequisite_grade_id: string | null
}

export default async function PracticePage() {
  if (!submissionReviewEnabled()) notFound()
  const profile = await requireAuth()
  const supabase = await createClient()

  const { data: enrollments } = await supabase
    .from('enrollments').select('course_id, course:courses(id, title)').eq('user_id', profile.id).eq('status', 'active')
  const courseIds = (enrollments || []).map((e) => e.course_id)
  const courseTitle = new Map<string, string>()
  for (const e of enrollments || []) {
    const c = e.course as unknown as { id: string; title: string } | null
    if (c) courseTitle.set(e.course_id, c.title)
  }

  let tasks: TaskRow[] = []
  const submittedCourses = new Set<string>()
  const lockedTasks = new Set<string>()
  let topPick: TaskRow | null = null

  if (courseIds.length > 0) {
    // RLS により、割り当てられていない OJT 課題は返らない
    const { data: t } = await supabase
      .from('review_tasks')
      .select('id, course_id, title, estimated_minutes, assignment_type, difficulty_level, target_skill_ids, prerequisite_grade_id')
      .in('course_id', courseIds).eq('is_active', true).order('order_index')
    tasks = (t || []) as TaskRow[]

    const today = learningDay(new Date())
    const { data: subs } = await supabase
      .from('review_submissions').select('course_id').eq('user_id', profile.id).eq('learning_day', today).neq('status', 'draft')
    for (const s of subs || []) submittedCourses.add(s.course_id)

    // 推薦（スキルマップ有効時）: 弱点×適正難易度で並べ、前提グレードでロック
    if (skillMapEnabled() && tasks.length) {
      const { data: levels } = await supabase.from('user_skill_levels').select('skill_id, current_level, confidence').eq('user_id', profile.id)
      const userSkillLevels: Record<string, { level: number | null; confidence: string }> = {}
      for (const l of levels || []) userSkillLevels[l.skill_id] = { level: l.current_level, confidence: l.confidence }

      const { data: approvedUg } = await supabase.from('user_grades').select('grade_id').eq('user_id', profile.id).eq('status', 'approved')
      const approvedIds = (approvedUg || []).map((g) => g.grade_id)
      const { data: allGrades } = await supabase.from('grades').select('id, level').in('course_id', courseIds)
      const gradeLevelById: Record<string, number> = {}
      for (const g of allGrades || []) gradeLevelById[g.id] = g.level
      const approvedGradeLevel = Math.max(0, ...approvedIds.map((id) => gradeLevelById[id] || 0))

      const recoInput: RecoTask[] = tasks.map((t) => ({
        id: t.id, assignment_type: t.assignment_type, difficulty_level: t.difficulty_level,
        target_skill_ids: t.target_skill_ids || [], prerequisite_grade_id: t.prerequisite_grade_id,
      }))
      const reco = recommendTasks(recoInput, { userSkillLevels, approvedGradeLevel, gradeLevelById })
      for (const r of reco) if (r.locked) lockedTasks.add(r.task.id)
      const taskById = new Map(tasks.map((t) => [t.id, t]))
      const firstOpen = reco.find((r) => !r.locked && !submittedCourses.has(taskById.get(r.task.id)!.course_id))
      topPick = firstOpen ? taskById.get(firstOpen.task.id) || null : null
    }
  }

  const byCourse = new Map<string, TaskRow[]>()
  for (const t of tasks) {
    const arr = byCourse.get(t.course_id) || []
    arr.push(t); byCourse.set(t.course_id, arr)
  }

  return (
    <StudentLayout isAdmin={isAdmin(profile.role)}>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">練習（毎日の提出）</h1>
        <p className="text-sm text-gray-500 mb-6">毎日1つ、課題を提出しましょう。添削が返ってきます。</p>

        {topPick && (
          <Link href={`/practice/${topPick.id}`}>
            <div className="mb-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-4 shadow-sm hover:brightness-105 transition">
              <div className="text-xs opacity-80 mb-1">▶ 今のあなたへのおすすめ</div>
              <div className="font-bold">{topPick.title}</div>
              <div className="text-xs opacity-85 mt-1">{TYPE_LABEL[topPick.assignment_type]}{topPick.difficulty_level ? `・難易度 ${topPick.difficulty_level}/5` : ''}</div>
            </div>
          </Link>
        )}

        {tasks.length === 0 && (
          <Card><CardBody><p className="text-sm text-gray-500">提出できる課題はまだありません。</p></CardBody></Card>
        )}

        {[...byCourse.entries()].map(([cid, list]) => (
          <div key={cid} className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-lg font-semibold text-gray-800">{courseTitle.get(cid) || 'コース'}</h2>
              {submittedCourses.has(cid)
                ? <Badge variant="success">今日は提出済み</Badge>
                : <Badge variant="warning">今日の提出がまだ</Badge>}
            </div>
            <div className="space-y-2">
              {list.map((t) => {
                const isLocked = lockedTasks.has(t.id)
                return (
                  <Link key={t.id} href={`/practice/${t.id}`}>
                    <Card className="hover:shadow-md transition-shadow">
                      <CardBody>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <span className="font-medium text-gray-900">{isLocked ? '🔒 ' : ''}{t.title}</span>
                            <div className="mt-1 flex items-center gap-2">
                              <Badge variant="info">{TYPE_LABEL[t.assignment_type] || t.assignment_type}</Badge>
                              {t.difficulty_level && <span className="text-xs text-gray-400">難易度 {t.difficulty_level}/5</span>}
                            </div>
                          </div>
                          {t.estimated_minutes && <span className="text-xs text-gray-400 shrink-0">目安 {t.estimated_minutes} 分</span>}
                        </div>
                      </CardBody>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </StudentLayout>
  )
}
