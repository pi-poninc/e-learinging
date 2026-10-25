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
- 推薦は、各ロードマップで**到達済みの最先端講座の“次の1本”**（進捗率で優先）。該当なしなら `recommendations: []`。
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
const { recommendations } = await res.json()
// recommendations を社員のトップ画面に「次におすすめ」として描画
```

## 注意

- トークンは**サーバ側のみ**で扱う（フロントに出さない）。漏れたら Render で差し替え。
- メールは e-learning 登録メールと一致している必要がある（表記ゆれ・別アドレスに注意）。
- 本APIは読み取り専用。受講登録やデータ変更はしない。
