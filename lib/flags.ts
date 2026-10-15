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
