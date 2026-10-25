# 本番稼働チェックリスト（Go-Live）

作ったものを「生きた状態」にするための、Render 設定の順番。所要10〜20分。
※ DBマイグレーションは本番適用済み（review_*/price_jpy/course_purchases/paths すべて確認済み）。

## 0. トークンを生成（ローカルで1回）
```
openssl rand -hex 32   # → INTRANET_API_TOKEN に使う
openssl rand -hex 24   # → CRON_SECRET に使う
```

## 1. Render の Environment に設定（Webサービス）

### 必須（既に入っていればOK）
```
NODE_VERSION=20.18.0
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=https://<本番URL>
VIMEO_ACCESS_TOKEN=...
```

### 学習導線＋習慣化（今回ONにする）
```
FEATURE_SUBMISSION_REVIEW=true
NEXT_PUBLIC_FEATURE_SUBMISSION_REVIEW=true
CRON_SECRET=<openssl rand -hex 24 の値>
```

### リマインド／週次ダイジェストのメール（任意・使うなら）
```
RESEND_API_KEY=<resend.com のキー>
REMINDER_FROM=onboarding@resend.dev   # 独自ドメイン検証後に差し替え
```

### イントラ連携（表示）
```
INTRANET_API_TOKEN=<openssl rand -hex 32 の値>
```
同じ値を pipon intranet のサーバ側にも設定（`docs/INTRANET_INTEGRATION.md`）。

## 2. Cron（render.yaml で自動作成。手動なら2本）
- `pipon-learning-reminders`：毎日 JST9時 → `POST /api/cron/reminders`
- `pipon-learning-weekly-digest`：毎週月 JST8時 → `POST /api/cron/weekly-digest`
- どちらも `CRON_SECRET` と `NEXT_PUBLIC_APP_URL` を環境変数に。

## 3. デプロイ後の動作確認
- [ ] ダッシュボードに「次の一歩」カード／🔥連続学習日が出る
- [ ] 各講座の先頭に「まず全体像を動画で」が表示・再生できる
- [ ] 受講者ナビに「練習（提出）」、管理ナビに「添削キュー」「効果測定」が出る
- [ ] `/admin/analytics` に講座別の修了率が出る
- [ ] レコメンド確認：
  ```
  curl -s -H "Authorization: Bearer $INTRANET_API_TOKEN" \
    "$NEXT_PUBLIC_APP_URL/api/recommendations?email=kentonanjo@pi-pon.com"
  ```
  → learner と recommendations が返る
- [ ] （メール設定時）リマインド手動実行で届く：
  ```
  curl -X POST -H "Authorization: Bearer $CRON_SECRET" "$NEXT_PUBLIC_APP_URL/api/cron/reminders"
  ```

## 4. 任意：決済を使うなら
`FEATURE_BILLING=true` ＋ `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`（`docs/BILLING.md`）。

---
関連: `DEPLOY.md`（全体）/ `docs/LEARNING_FLOW.md`（導線）/ `docs/INTRANET_INTEGRATION.md`（連携）
