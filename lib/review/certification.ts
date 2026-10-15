/**
 * 認定の要件判定（純関数）と認定番号の採番。
 * 認定は自動確定しない（eligible → 管理者が approved で発行）。判定根拠は保存する。
 */
export interface CertRequirements {
  grade_level?: number
  required_task_ids?: string[]
  demo_day?: boolean
}

export interface CertContext {
  approvedGradeLevel: number
  reviewedTaskIds: Set<string>  // 添削まで返った課題
  hasDemoDay: boolean
}

export function certificationEligible(ctx: CertContext, req: CertRequirements): boolean {
  const hasAny = req.grade_level != null || (req.required_task_ids && req.required_task_ids.length > 0) || req.demo_day
  if (!hasAny) return false
  if (req.grade_level != null && ctx.approvedGradeLevel < req.grade_level) return false
  if (req.required_task_ids) {
    for (const tid of req.required_task_ids) if (!ctx.reviewedTaskIds.has(tid)) return false
  }
  if (req.demo_day && !ctx.hasDemoDay) return false
  return true
}

export function genCertificateNumber(now: Date = new Date()): string {
  const year = now.getUTCFullYear()
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `PIPON-${year}-${rand}`
}
