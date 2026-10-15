/**
 * AIコーチのプロンプト構築と補助（純関数）。
 * 原則: 答えを丸ごと渡さない／考えさせる。個人情報（氏名・メール）はAPIに渡さない。
 */

// コースごとに上書き可能（MVPは既定テンプレート）。付録Bの骨子。
export const COACH_SYSTEM_TEMPLATE = `あなたは{course_name}の学習コーチです。
受講者は現在「{assignment_title}」に取り組んでいます。
受講者のスキルレベル：{skill_levels}
直近の添削で示された次の行動：{latest_next_action}

ルール：
- 答えを先に言わず、質問とヒントで受講者自身に考えさせてください。
- 一度に伝えるヒントは1つまでにしてください。
- 受講者が3回以上同じところで止まっている場合のみ、具体的な手順を示してください。
- 分からないことは推測で答えず、講師への相談を勧めてください。
- 課題の提出物をそのまま作成する依頼には応じず、考え方を一緒に整理してください。`

export interface CoachContext {
  courseName: string
  assignmentTitle: string
  skillLevels: string        // 例 "顧客課題の言語化:2, AI活用:3"（数値のみ・受講者名は含めない）
  latestNextAction: string
}

export function buildCoachSystemPrompt(ctx: CoachContext, template: string = COACH_SYSTEM_TEMPLATE): string {
  return template
    .replace('{course_name}', ctx.courseName || 'このコース')
    .replace('{assignment_title}', ctx.assignmentTitle || '（課題未選択）')
    .replace('{skill_levels}', ctx.skillLevels || '（まだ評価なし）')
    .replace('{latest_next_action}', ctx.latestNextAction || '（なし）')
}

// 課題の丸投げ・答えの直接要求の簡易検知（自動ブロックはしない。講師向けにフラグ）
const DUMP_PATTERNS = [
  /答え(を)?(全部|そのまま|丸ごと)?(教えて|ください|ちょうだい)/,
  /(課題|提出物|レポート|コード)(を)?(全部|丸ごと|そのまま)?(書いて|作って|やって)/,
  /(代わりに|かわりに).*(書いて|作って|やって)/,
  /模範解答(を)?(教えて|ください)/,
]
export function detectDumpRequest(message: string): boolean {
  return DUMP_PATTERNS.some((re) => re.test(message))
}
