# pipon learning デプロイ手順（Render）

本番は Render（Node 20.x）。初回は手動、以後は GitHub push で自動デプロイ。

## 1. サービス作成

### 方法A: Blueprint（推奨）
1. Render ダッシュボード → **Blueprints** → **New Blueprint Instance**
2. リポジトリ `pi-poninc/e-learinging` を選択（`render.yaml` を自動検出）
3. Web サービス `pipon-learning` と Cron `pipon-learning-reminders` がまとめて作られる
4. `sync:false` の環境変数（下記）を入力して **Apply**

### 方法B: 手動
- **New → Web Service** → リポジトリ連携
- Build: `npm ci && npm run build` / Start: `npm run start`
- 環境変数を手入力

## 2. 環境変数（Web サービス）

| 変数 | 必須 | 値の取得元 |
|---|---|---|
| `NODE_VERSION` | ✅ | `20.18.0`（Node 24 非対応） |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | `https://hxbiesgnijkmsbjxyzby.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase → Project Settings → API（publishable/anon） |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase → API → service_role（**秘匿**） |
| `NEXT_PUBLIC_APP_URL` | ✅ | 本番URL（例 `https://pipon-learning.onrender.com`） |
| `VIMEO_ACCESS_TOKEN` | ✅ | https://developer.vimeo.com/apps |
| `CRON_SECRET` | 任意※ | 自動生成（Web と Cron で同一値にする） |
| `RESEND_API_KEY` | 任意 | https://resend.com（リマインドメール送信に必要） |
| `REMINDER_FROM` | 任意 | 送信元アドレス（独自ドメイン検証後。既定 `onboarding@resend.dev`） |
| `ANTHROPIC_API_KEY` | 任意 | AIコーチ/下書きを使う場合 |

※ `CRON_SECRET` は自動リマインドを使うなら必須。

### 機能フラグ（有効化したいものだけ `true`）
育成プログラムは既定 **OFF**。段階的に ON にできる（OFFでも既存機能に影響なし）。

```
FEATURE_SUBMISSION_REVIEW  # 毎日提出 × 添削（シャドテン型・習慣化）
FEATURE_SKILL_MAP          # スキルマップ＆グレード
FEATURE_PEER_REVIEW        # ピアレビュー＆添削者育成
FEATURE_AI_COACH           # AIコーチ（要 ANTHROPIC_API_KEY）
FEATURE_COHORT             # コホート＆デモデイ
FEATURE_CERTIFICATION      # 認定・修了証の公開確認
FEATURE_ORG_ADMIN          # 企業（組織）管理
FEATURE_BILLING            # Stripe 決済（要 STRIPE_* / 次節）
```

クライアント側のナビ表示も切り替える場合は `NEXT_PUBLIC_` を接頭辞に付けた同名フラグも設定する
（例 `NEXT_PUBLIC_FEATURE_SUBMISSION_REVIEW=true`）。

## 3. 自動リマインド（Cron）

- Cron サービス `pipon-learning-reminders` が毎日 **JST 9:00（UTC 0:00）** に
  `POST /api/cron/reminders` を `Authorization: Bearer $CRON_SECRET` 付きで叩く。
- `RESEND_API_KEY` 未設定時は送信せず集計のみ（エラーにはならない）。
- 手動確認は管理画面「リマインド」からも可能（dry-run 一覧 → 送信）。
- 動作確認:
  ```bash
  curl -X POST -H "Authorization: Bearer <CRON_SECRET>" \
    "$NEXT_PUBLIC_APP_URL/api/cron/reminders?days=3"
  ```

## 4. 決済（Stripe・任意）

`FEATURE_BILLING=true` のときだけ有効。詳細は [`docs/BILLING.md`](docs/BILLING.md)。
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` を設定
- Webhook を `POST $NEXT_PUBLIC_APP_URL/api/billing/webhook` に向ける

## 5. デプロイ後チェック

- [ ] `/login` でログインできる
- [ ] 受講者ダッシュボードに講座が出る
- [ ] Vimeo 動画が再生され、進捗が保存される
- [ ] 管理画面「リマインド」で対象一覧が表示される
- [ ] （Cron）Render の Cron 実行ログで 200 が返っている

## 補足

- マイグレーションは `supabase db push` を使わず、`supabase db query --linked -f <file>.sql` で単発適用する（台帳乖離を避ける）。
- Node は 20.x 固定（`.node-version` + `package.json` engines + `NODE_VERSION`）。
