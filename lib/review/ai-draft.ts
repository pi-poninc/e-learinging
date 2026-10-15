/**
 * AI下書き補助（添削者向け）。出力はそのまま受講者に出さない（添削者が編集して公開）。
 * 目的は添削時間の短縮と品質の底上げ。純関数部分（プロンプト構築・書き換え率）をテストする。
 */
export interface DraftRubricItem { id: string; label: string }
export interface DraftContext {
  assignmentTitle: string
  instructions: string
  submissionText: string
  rubricItems: DraftRubricItem[]
  exemplars: string[]   // 良い添削の例（個人情報は除去済みで渡す）
}

export const DRAFT_SYSTEM_PROMPT = `あなたは学習コースの添削者を補助するアシスタントです。
提出物とルーブリックをもとに、添削の「下書き」を作ります。これは添削者が編集してから公開するもので、そのまま受講者には出しません。

次の形式の JSON だけを出力してください（前後に説明文を付けない）:
{
  "good_points": "良かった点（具体的に1〜3個）",
  "improvements": "改善点（重要なものから最大3個。どこをどう直すか）",
  "next_action": "次にやること（1つに絞る。次回の提出で確認できる行動）",
  "rubric_scores": { "<rubric_item_id>": 1〜5 の整数 }
}
初期の受講者には改善点を絞り、良かった点を厚めに。断定しすぎず、根拠を添えてください。`

export function buildDraftUserContent(ctx: DraftContext): string {
  const rubric = ctx.rubricItems.map((r) => `- ${r.label} (id: ${r.id})`).join('\n') || '（ルーブリックなし）'
  const ex = ctx.exemplars.length ? `\n\n参考（過去の良い添削の例）:\n${ctx.exemplars.map((e) => `---\n${e}`).join('\n')}` : ''
  return `課題: ${ctx.assignmentTitle}
課題の説明: ${ctx.instructions || '（なし）'}

評価するルーブリック項目:
${rubric}

受講者の提出:
${ctx.submissionText || '（本文なし）'}${ex}`
}

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  let cur = new Array(n + 1).fill(0)
  for (let i = 1; i <= m; i++) {
    cur[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, cur] = [cur, prev]
  }
  return prev[n]
}

/** AI下書きから最終版への書き換え率（0=無変更, 1=全書き換え）。 */
export function rewriteRate(original: string, edited: string): number {
  const o = (original || '').trim()
  const e = (edited || '').trim()
  const maxLen = Math.max(o.length, e.length)
  if (maxLen === 0) return 0
  return Math.round((levenshtein(o, e) / maxLen) * 100) / 100
}
