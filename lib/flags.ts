/**
 * フィーチャーフラグ。既存サイトに影響を出さず新機能を切り替える。
 * 既存の env 読み込み規約（process.env を lib で読む）に合わせる。
 */

function envFlag(name: string): boolean {
  const v = process.env[name]
  if (!v) return false
  return ['1', 'true', 'on', 'yes'].includes(v.toLowerCase())
}

/** 提出 × 添削 機能。FEATURE_SUBMISSION_REVIEW が真のときだけ有効。 */
export function submissionReviewEnabled(): boolean {
  return envFlag('FEATURE_SUBMISSION_REVIEW')
}

/** スキルマップ＆グレード（育成プログラム Phase A）。FEATURE_SKILL_MAP が真のとき有効。 */
export function skillMapEnabled(): boolean {
  return envFlag('FEATURE_SKILL_MAP')
}

/** ピアレビュー＆添削者育成（育成プログラム Phase C）。FEATURE_PEER_REVIEW が真のとき有効。 */
export function peerReviewEnabled(): boolean {
  return envFlag('FEATURE_PEER_REVIEW')
}

/** AIコーチ（育成プログラム Phase D）。FEATURE_AI_COACH が真のとき有効。 */
export function aiCoachEnabled(): boolean {
  return envFlag('FEATURE_AI_COACH')
}

/** コホート＆デモデイ（育成プログラム Phase E）。FEATURE_COHORT が真のとき有効。 */
export function cohortEnabled(): boolean {
  return envFlag('FEATURE_COHORT')
}

/** 認定・企業管理（育成プログラム Phase F）。FEATURE_CERTIFICATION が真のとき有効。 */
export function certificationEnabled(): boolean {
  return envFlag('FEATURE_CERTIFICATION')
}

/** 企業（組織）管理（育成プログラム Phase F-2）。FEATURE_ORG_ADMIN が真のとき有効。 */
export function orgAdminEnabled(): boolean {
  return envFlag('FEATURE_ORG_ADMIN')
}

/** 決済（Stripe 買い切り）。FEATURE_BILLING が真のとき有効。 */
export function billingEnabled(): boolean {
  return envFlag('FEATURE_BILLING')
}
