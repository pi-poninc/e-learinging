// FDEレベル（1-100）: 既存の完了データから集計したXPで決まる。
// レベル L に到達するのに必要なXP = L^2（level = floor(sqrt(xp)) をクランプ）。
// 現状の全コンテンツを完了しても中位レベル。100は長期の到達目標。

export const XP_RULES = { lesson: 10, quiz: 25, case: 40, assignment: 40 }

export function levelFromXp(xp: number): number {
  return Math.max(1, Math.min(100, Math.floor(Math.sqrt(Math.max(0, xp)))))
}

// そのレベルに到達するために必要な累計XP
export function xpForLevel(level: number): number {
  return level * level
}

export function levelTitle(level: number): string {
  if (level >= 100) return 'マスターFDE'
  if (level >= 85) return 'プリンシパルFDE'
  if (level >= 65) return 'リードFDE'
  if (level >= 45) return 'シニアFDE'
  if (level >= 25) return 'FDE'
  if (level >= 10) return 'ジュニアFDE'
  return '見習いFDE'
}

export interface LevelInfo {
  xp: number
  level: number
  title: string
  levelFloorXp: number   // 現レベル到達XP
  nextLevelXp: number    // 次レベル到達XP
  intoLevel: number      // 現レベル内で稼いだXP
  levelSpan: number      // 現→次レベルに必要なXP
  pctToNext: number      // 次レベルまでの進捗(0-100)
  breakdown: { lessons: number; quizzes: number; cases: number; assignments: number }
}

export function computeLevel(b: { lessons: number; quizzes: number; cases: number; assignments: number }): LevelInfo {
  const xp = b.lessons * XP_RULES.lesson + b.quizzes * XP_RULES.quiz +
             b.cases * XP_RULES.case + b.assignments * XP_RULES.assignment
  const level = levelFromXp(xp)
  const levelFloorXp = xpForLevel(level)
  const nextLevelXp = xpForLevel(Math.min(100, level + 1))
  const span = Math.max(1, nextLevelXp - levelFloorXp)
  const into = xp - levelFloorXp
  return {
    xp, level, title: levelTitle(level), levelFloorXp, nextLevelXp,
    intoLevel: into, levelSpan: span,
    pctToNext: level >= 100 ? 100 : Math.max(0, Math.min(100, Math.round((into / span) * 100))),
    breakdown: b,
  }
}
