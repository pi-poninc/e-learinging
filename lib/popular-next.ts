/**
 * 協調フィルタ（純関数）：「この講座を修了した人が、よく一緒に修了している講座」。
 * アイテム間の共起（完了者集合の重なり）でスコアリングする。
 * - 受講者が少ないうちは弱い信号だが、データが増えるほど効く。
 * - ロードマップに依存しない“横のつながり”の推薦（roadmap順の補完）。
 */
export interface PopularNext {
  courseId: string
  score: number
  coCompleters: number // 一緒に修了した人数
}

/**
 * @param completersByCourse courseId → 修了したユーザーIDの集合
 * @param targetCompleted    対象ユーザーが修了済みの courseId 集合
 * @param limit              返す件数
 * @param minCoCompleters    最低共起人数（ノイズ除去）。既定1
 */
export function popularNextCourses(
  completersByCourse: Record<string, Set<string>>,
  targetCompleted: Set<string>,
  limit = 3,
  minCoCompleters = 1,
): PopularNext[] {
  // 候補講座（対象が未修了）ごとに、対象の修了講座との“完了者の重なり”を合算
  const score = new Map<string, { score: number; co: Set<string> }>()

  for (const doneId of targetCompleted) {
    const peers = completersByCourse[doneId]
    if (!peers) continue
    for (const [candId, candCompleters] of Object.entries(completersByCourse)) {
      if (candId === doneId || targetCompleted.has(candId)) continue // 既修了/同一は除外
      // doneId を修了した人のうち、candId も修了した人数（＝共起）
      let overlap = 0
      const coUsers = new Set<string>()
      for (const u of peers) {
        if (candCompleters.has(u)) { overlap += 1; coUsers.add(u) }
      }
      if (overlap <= 0) continue
      const cur = score.get(candId) || { score: 0, co: new Set<string>() }
      cur.score += overlap
      for (const u of coUsers) cur.co.add(u)
      score.set(candId, cur)
    }
  }

  return Array.from(score.entries())
    .map(([courseId, v]) => ({ courseId, score: v.score, coCompleters: v.co.size }))
    .filter((r) => r.coCompleters >= minCoCompleters)
    .sort((a, b) => b.score - a.score || b.coCompleters - a.coCompleters)
    .slice(0, limit)
}
