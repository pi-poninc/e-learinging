/**
 * 講座レコメンド（純関数）。
 * 「ある講座を修了したら、ロードマップ上の“次に進むべき講座”をおすすめする」。
 * - ユーザーが1本以上修了しているロードマップで、未修了かつ直前が修了済みの講座を「次」とする
 * - ロードマップの進捗が高いほど優先（あと少しで完走＝背中を押す）
 * - courseId で重複排除。完了済みは出さない
 */
export interface PathItemLite {
  courseId: string
  sortOrder: number
  milestone: string | null
}
export interface PathLite {
  id: string
  title: string
  items: PathItemLite[]
}
/** courseId → 完了状況。total>0 かつ done>=total で「修了」。 */
export type CompletionMap = Record<string, { total: number; done: number }>

export interface CourseReco {
  courseId: string
  title: string
  reason: string
  pathId: string
  pathTitle: string
  score: number
}

function isComplete(c: { total: number; done: number } | undefined): boolean {
  return !!c && c.total > 0 && c.done >= c.total
}

export function recommendNextCourses(
  paths: PathLite[],
  completion: CompletionMap,
  titleById: Record<string, string>,
  limit = 3,
): CourseReco[] {
  const byCourse = new Map<string, CourseReco>()

  for (const path of paths) {
    const items = [...path.items].sort((a, b) => a.sortOrder - b.sortOrder)
    const completedItems = items.filter((it) => isComplete(completion[it.courseId]))
    if (completedItems.length === 0) continue // まだ始めていない → 「次」の文脈でない

    // 到達済みの“最先端”（最後に修了した講座）を基準に、その先で未修了の最初の1本を薦める。
    // 手前を飛ばしていても、学習を前に進める方向で推薦する。
    const furthest = completedItems[completedItems.length - 1] // sort済みなので最大 sortOrder
    const furthestTitle = titleById[furthest.courseId] || ''
    const next = items.find(
      (it) => it.sortOrder > furthest.sortOrder && !isComplete(completion[it.courseId]),
    )
    if (!next) continue // 最先端より先は無い（＝実質そのパスは終端まで到達）

    const pathPct = items.length ? completedItems.length / items.length : 0
    const score = Math.round(pathPct * 100) + completedItems.length
    const reason = furthestTitle ? `「${furthestTitle}」の次のステップ` : `${path.title.replace('【まずここから】', '')}の続き`
    const existing = byCourse.get(next.courseId)
    if (!existing || score > existing.score) {
      byCourse.set(next.courseId, {
        courseId: next.courseId,
        title: titleById[next.courseId] || '(講座)',
        reason,
        pathId: path.id,
        pathTitle: path.title.replace('【まずここから】', ''),
        score,
      })
    }
  }

  return Array.from(byCourse.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
