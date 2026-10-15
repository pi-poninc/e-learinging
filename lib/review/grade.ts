/**
 * 単一の成長軸＝スキルベースのグレード。/journey と ダッシュボードのレベル表示を、
 * スキルマップが有効なコースでは「グレード」に統一する（XPは FEATURE_SKILL_MAP オフ時の後方互換）。
 */

export interface UnifiedGradeLevel {
  mode: 'grade'
  level: number            // 現在の承認済みグレードの段階（未取得は0）
  title: string            // 現在のグレード名 or '未取得'
  nextTitle: string | null // 次のグレード名
  pctToNext: number        // 次グレードの要件達成率（%）
  metSkills: number
  neededSkills: number
  awaitingApproval: boolean // 次グレードが eligible（講師承認待ち）
  courseTitle: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function computeGradeLevel(supabase: any, uid: string): Promise<UnifiedGradeLevel | null> {
  const { data: enrolls } = await supabase
    .from('enrollments').select('course_id').eq('user_id', uid).eq('status', 'active')
  const courseIds = (enrolls || []).map((e: { course_id: string }) => e.course_id)
  if (courseIds.length === 0) return null

  const { data: maps } = await supabase
    .from('skill_maps').select('course_id, course:courses(title)')
    .in('course_id', courseIds).eq('is_active', true).limit(1)
  const map = maps?.[0]
  if (!map) return null
  const courseId = map.course_id
  const courseTitle = (map.course as { title: string } | null)?.title || ''

  const { data: grades } = await supabase
    .from('grades').select('id, level, name, requirements').eq('course_id', courseId).order('level')
  if (!grades || grades.length === 0) return null

  const { data: userGrades } = await supabase
    .from('user_grades').select('grade_id, status').eq('user_id', uid)
  const statusByGrade = new Map<string, string>((userGrades || []).map((g: { grade_id: string; status: string }) => [g.grade_id, g.status]))

  const { data: levels } = await supabase
    .from('user_skill_levels').select('skill_id, current_level, confidence').eq('user_id', uid)
  const levelMap = new Map<string, { level: number; confidence: string }>(
    (levels || []).map((l: { skill_id: string; current_level: number; confidence: string }) => [l.skill_id, { level: l.current_level, confidence: l.confidence }]),
  )

  // 現在グレード＝承認済みの最高段階
  let current: { level: number; name: string } | null = null
  for (const g of grades) {
    if (statusByGrade.get(g.id) === 'approved' && (!current || g.level > current.level)) {
      current = { level: g.level, name: g.name }
    }
  }
  const currentLevel = current?.level ?? 0
  const title = current?.name ?? '未取得'

  const next = grades.find((g: { level: number }) => g.level > currentLevel) || null

  let pctToNext = 100
  let metSkills = 0
  let neededSkills = 0
  let awaitingApproval = false
  let nextTitle: string | null = null

  if (next) {
    nextTitle = next.name
    const reqs = (next.requirements || {}) as Record<string, number>
    const skillIds = Object.keys(reqs)
    neededSkills = skillIds.length
    metSkills = skillIds.filter((sid) => {
      const l = levelMap.get(sid)
      return l && l.confidence !== 'low' && l.level >= reqs[sid]
    }).length
    awaitingApproval = statusByGrade.get(next.id) === 'eligible'
    pctToNext = awaitingApproval ? 100 : neededSkills ? Math.round((metSkills / neededSkills) * 100) : 0
  }

  return { mode: 'grade', level: currentLevel, title, nextTitle, pctToNext, metSkills, neededSkills, awaitingApproval, courseTitle }
}
