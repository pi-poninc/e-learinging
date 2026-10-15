# 決済（Stripe 買い切り）

講座ごとの**買い切り**（one-time）決済。`FEATURE_BILLING=true` のときだけ有効。
既存の無料受講フローには一切影響しない（既定 OFF）。

## モデル

- 講座に `price_jpy`（円・税込想定）を設定すると有料講座になる。null/0 は無料。
- 受講者は「ストア」(`/store`) から購入 → Stripe Checkout → 決済完了で自動的に受講登録される。
- 課金単位は JPY（ゼロ桁通貨なのでそのまま円を `unit_amount` に渡す）。

> 月額サブスクや組織まとめ買いが必要になったら、`createCheckoutSession` の
> `mode` と `course_purchases` を拡張する。現状は買い切りのみ。

## セットアップ

1. Stripe アカウントを作成（https://dashboard.stripe.com）
2. **API キー**（Developers → API keys）の Secret key を `STRIPE_SECRET_KEY` に設定
3. **Webhook**（Developers → Webhooks → Add endpoint）
   - URL: `https://<本番ドメイン>/api/billing/webhook`
   - イベント: `checkout.session.completed`
   - 発行された署名シークレットを `STRIPE_WEBHOOK_SECRET` に設定
4. Render の環境変数に以下を設定して再デプロイ
   ```
   FEATURE_BILLING=true
   NEXT_PUBLIC_FEATURE_BILLING=true   # ナビに「ストア」を出す
   STRIPE_SECRET_KEY=sk_live_xxx      # テスト中は sk_test_xxx
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```
5. 管理画面「講座管理 → 編集」で価格を入力して保存

## 動作

| 画面 | 役割 |
|---|---|
| `/store` | 受講者向け。有料・未購入の公開講座を一覧し購入ボタンを出す |
| `POST /api/billing/checkout` | Checkout セッションを作り URL を返す（要ログイン・要フラグ） |
| `POST /api/billing/webhook` | Stripe 署名検証 → 購入履歴記録＋受講登録（冪等） |
| `/admin/billing` | 管理向け。累計売上・件数・明細 |

## 冪等性・安全性

- `course_purchases.stripe_session_id` が unique。Webhook 再送は `onConflict` で無視。
- Webhook は HMAC-SHA256 署名を自前検証（`lib/billing.ts` の `verifyWebhookSignature`、許容5分）。
- `course_purchases` への書き込みは service_role（webhook）のみ。RLS で一般ユーザーの書込は不可。
- 購入済み/受講中の講座は checkout を 409 で弾く。

## テスト

Stripe テストモード（`sk_test_` / テストカード `4242 4242 4242 4242`）で一連を確認できる。
ローカルは Stripe CLI の `stripe listen --forward-to localhost:3000/api/billing/webhook` が便利。
