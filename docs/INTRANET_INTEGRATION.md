# pipon intranet 連携 ― 「次におすすめ講座」API

pipon intranet（自社開発アプリ）から e-learning を呼び、各社員に
**「次におすすめの講座」**を表示するためのサーバ間連携。

## 概要

- 方式：**イントラ → e-learning の読み取りAPIを呼ぶ**（Pull）。
- 認証：共有トークン（`INTRANET_API_TOKEN`）の Bearer。**サーバ間のみ**（ブラウザJSから直接呼ばない＝トークン露出防止）。
- 本人特定：社員の**メールアドレス**で指定できる（e-learning のユーザーIDでも可）。

## エンドポイント

```
GET /api/recommendations?email=<社員のメール>&limit=3
Authorization: Bearer <INTRANET_API_TOKEN>
```

パラメータ:
| 名前 | 必須 | 説明 |
|---|---|---|
| `email` | △ | 社員のメール。`userId` と二択。イントラ側はこちらが使いやすい |
| `userId` | △ | e-learning のユーザーID（UUID）。`email` と二択 |
| `limit` | 任意 | 最大件数（既定3・上限10） |

レスポンス（200）:
```json
{
  "userId": "eab89fcd-....",
  "learner": {
    "name": "南條 健人",
    "level": { "level": 12, "title": "ジュニアFDE", "xp": 155 },
    "masterPath": {
      "title": "pipon流の働き方 ― 王道ジャーニー",
      "overallPct": 18,
      "nextCourse": {
        "courseId": "e7643443-....",
        "title": "Claude Codeの使い方 ― 環境構築・ターミナルから自走まで",
        "url": "https://<app>/courses/e7643443-...."
      }
    }
  },
  "recommendations": [
    {
      "courseId": "b42311d6-....",
      "title": "セキュリティ基礎 ― 全員のための情報セキュリティ入門",
      "reason": "「はじめてのGitとコマンド」の次のステップ",
      "pathTitle": "開発ツール入門ロードマップ ...",
      "url": "https://<app>/courses/b42311d6-...."
    }
  ]
}
```
- `learner`：表示用の学習状況サマリ。
  - `level`：FDEレベル（1〜100）と称号・XP。
  - `masterPath`：王道ジャーニーの全体進捗％と「次にやる1本」（未開始なら先頭講座、完走なら `nextCourse: null`）。
- `recommendations`：各ロードマップで**到達済みの最先端講座の“次の1本”**（進捗率で優先）。該当なしなら `[]`。
- その社員が見つからない（未登録メール）→ `404` ＋ `recommendations: []`。

エラー:
| コード | 意味 |
|---|---|
| 401 | トークンもログインも無い |
| 403 | 他人の `email`/`userId` を、トークン無し・非スタッフで要求 |
| 404 | メールに該当するユーザーがいない |

## セットアップ

1. 長いランダム文字列を生成（例 `openssl rand -hex 32`）。
2. Render（e-learning）の環境変数に設定：
   ```
   INTRANET_API_TOKEN=<生成した文字列>
   ```
3. pipon intranet 側にも同じ値を秘密として持たせ、**サーバ側から**呼ぶ。

## イントラ側 実装例

```bash
curl -s -H "Authorization: Bearer $INTRANET_API_TOKEN" \
  "https://<app>/api/recommendations?email=kentonanjo@pi-pon.com&limit=3"
```

```ts
// Node（イントラのサーバ側）
const res = await fetch(
  `${ELEARNING_URL}/api/recommendations?email=${encodeURIComponent(email)}`,
  { headers: { Authorization: `Bearer ${process.env.INTRANET_API_TOKEN}` } },
)
const { learner, recommendations } = await res.json()
// learner と recommendations を社員のトップ画面に描画
```

## イントラ側 実装例（サーバ経由でフロントへ）

トークンはサーバ側に置き、ブラウザには結果だけ渡します。

### 1) サーバのプロキシ route（例：Next.js / App Router）
```ts
// intranet: app/api/learning/route.ts
export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get('email')!
  const r = await fetch(
    `${process.env.ELEARNING_URL}/api/recommendations?email=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${process.env.INTRANET_API_TOKEN}` }, cache: 'no-store' },
  )
  return new Response(await r.text(), { status: r.status, headers: { 'content-type': 'application/json' } })
}
```

### 2) 表示コンポーネント（例：React）
```tsx
// intranet: components/LearningPanel.tsx
'use client'
import { useEffect, useState } from 'react'

type Reco = { courseId: string; title: string; reason: string; pathTitle: string; url: string }
type Data = {
  learner?: { name: string | null; level: { level: number; title: string; xp: number };
    masterPath: { title: string; overallPct: number; nextCourse: { title: string; url: string } | null } | null }
  recommendations: Reco[]
}

export function LearningPanel({ email }: { email: string }) {
  const [data, setData] = useState<Data | null>(null)
  useEffect(() => {
    fetch(`/api/learning?email=${encodeURIComponent(email)}`)
      .then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => {})
  }, [email])
  if (!data) return null
  const L = data.learner
  const mp = L?.masterPath

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      {L && (
        <div>
          <strong>{L.name ?? '学習状況'}</strong>{' '}
          <span>Lv.{L.level.level}（{L.level.title}）</span>
          {mp && (
            <div>
              {mp.title}：{mp.overallPct}%
              {mp.nextCourse && (
                <> ・ 次は <a href={mp.nextCourse.url} target="_blank" rel="noreferrer">{mp.nextCourse.title}</a></>
              )}
            </div>
          )}
        </div>
      )}
      {data.recommendations.length > 0 && (
        <div>
          <div style={{ fontWeight: 600 }}>次におすすめの講座</div>
          <ul>
            {data.recommendations.map((r) => (
              <li key={r.courseId}>
                <a href={r.url} target="_blank" rel="noreferrer">{r.title}</a>
                <small>（{r.reason}）</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
```
使い方：`<LearningPanel email={ログイン中の社員メール} />` を社員トップに置くだけ。

## 注意

- トークンは**サーバ側のみ**で扱う（フロントに出さない）。漏れたら Render で差し替え。
- メールは e-learning 登録メールと一致している必要がある（表記ゆれ・別アドレスに注意）。
- 本APIは読み取り専用。受講登録やデータ変更はしない。
