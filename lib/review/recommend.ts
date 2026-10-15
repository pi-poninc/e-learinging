/**
 * 次の課題の推薦（純関数・原則G3）。
 * - 弱いスキルを対象にする
 * - 難易度は「現在レベル＋0〜1」を優先
 * - 前提グレードを満たさない課題はロック（解放条件つきで表示）
 */
export interface RecoTask {
  id: string
  assignment_type: string
  difficulty_level: number | null
  target_skill_ids: string[]
  prerequisite_grade_id: string | null
}

export interface RecoContext {
  userSkillLevels: Record<string, { level: number | null; confidence: string }>
  approvedGradeLevel: number                 // 現在の承認済みグレード段階（未取得=0）
  gradeLevelById: Record<string, number>     // grade_id → 段階
}

export interface RecoResult {
  task: RecoTask
  locked: boolean
  score: number
  weakestLevel: number
}

export function recommendTasks(tasks: RecoTask[], ctx: RecoContext): RecoResult[] {
  const results: RecoResult[] = tasks.map((task) => {
    // 対象スキルのうち最も弱いレベル（対象が無ければ0扱い＝基礎向け）
    const levels = task.target_skill_ids.map((sid) => ctx.userSkillLevels[sid]?.level ?? 0)
    const weakest = levels.length ? Math.min(...levels) : 0

    const difficulty = task.difficulty_level ?? weakest + 1
    const gap = difficulty - weakest
    // 現在レベル＋1 が最良、次に＋0、易しすぎ(<0)や難しすぎ(>1)は下げる
    const gapScore = gap === 1 ? 3 : gap === 0 ? 2 : gap < 0 ? 0 : gap === 2 ? 1 : 0
    const weaknessScore = 5 - weakest // 弱いほど高い
    const score = weaknessScore * 10 + gapScore

    const locked =
      task.prerequisite_grade_id != null &&
      (ctx.gradeLevelById[task.prerequisite_grade_id] ?? 0) > ctx.approvedGradeLevel

    return { task, locked, score, weakestLevel: weakest }
  })

  // ロックされていないものをスコア降順、ロックは後ろ
  return results.sort((a, b) => {
    if (a.locked !== b.locked) return a.locked ? 1 : -1
    return b.score - a.score
  })
}
