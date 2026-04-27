# E-Learning プロジェクト

## Supabase 設定

- **Project URL**: https://hxbiesgnijkmsbjxyzby.supabase.co
- **Publishable Key**: sb_publishable_WkTiOffAezO3X9kotzrGjQ_Gq1TBARy
- **PostgreSQL接続文字列**: postgresql://postgres:[YOUR-PASSWORD]@db.hxbiesgnijkmsbjxyzby.supabase.co:5432/postgres
- **Project Ref**: hxbiesgnijkmsbjxyzby
- **GitHub**: git@github.com:pi-poninc/e-learinging.git
- **Admin User**: seiyakitazume@pi-pon.com (UUID: bab3dae7-813b-43ee-b7f9-200ca779dcfd)

## 技術スタック

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS
- Supabase (PostgreSQL + Auth + Storage)
- @vimeo/player + Vimeo API
- jsPDF（修了証PDF生成）
- デプロイ先: Render (Node 20.x)

## 実装済み機能

### MVP
- [x] ユーザー認証（Supabase Auth）+ ロールベースアクセス制御
- [x] 講座管理（CRUD）+ セクション + レッスン
- [x] Vimeo動画埋め込み + 進捗自動保存（10秒間隔）
- [x] 受講者ダッシュボード + 進捗表示
- [x] 管理画面（講座/レッスン/受講者/進捗）
- [x] Vimeo API連携（動画メタデータ自動取得、動画一覧取得）

### 追加機能
- [x] テスト/クイズ（4種: 単一選択/複数選択/○×/並び替え、サーバーサイド採点）
- [x] 課題提出（ファイルアップロード + 採点/フィードバック）
- [x] 修了証自動発行（PDF生成、CERT-YYYY-XXXXX採番）
- [x] レッスン受講制御（順序モード: is_sequential）
- [x] スマート「次へ」ボタン（レッスン→テスト→課題の自動ナビゲーション）

## DB テーブル (14)

profiles, courses, sections, lessons, enrollments, lesson_progress,
quizzes, quiz_questions, quiz_options, quiz_attempts, quiz_answers,
assignments, assignment_submissions, certificates

## 環境変数

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
VIMEO_ACCESS_TOKEN
```

## コマンド

```bash
npm run dev      # 開発サーバー起動
npm run build    # プロダクションビルド
npm run start    # プロダクションサーバー起動
supabase db push # マイグレーション適用
supabase db query --linked "SQL" # リモートDB直接クエリ
```

## Vimeo API 認証情報

- **Client Identifier**: 08999e349806c82359de7e1680642d821485615e
- **Client Secret**: AUrha4QiljyOImIvRHMaPRO0/6uklO1untO1fK9eYsxlXsARdT95pPTYWkZNtyrhBWAY6pBxWQJR1T4aLKL8t7S9ZLTePCOmQ9lsvDKpa15ha301r1mK4BtTNDeqpg4s
- **Access Token**: `.env.local` の `VIMEO_ACCESS_TOKEN` に設定
- **取得先**: https://developer.vimeo.com/apps

## 次のステップ

- [ ] Renderに環境変数を設定してデプロイ
- [ ] Vimeo Access Token を取得して設定
- [ ] Stripe決済連携（将来）
- [ ] メール通知（将来）

## 既知の注意点

- Middleware のリダイレクト時は必ずSupabase cookieをコピーすること（lessons.md参照）
- Supabase の深いネストクエリは避け、段階的にクエリを分割すること
- profilesテーブルのRLS内で get_user_role() を使う場合、security definer が必須
- Node.js 20.x を指定（.node-version + package.json engines）。Node 24 は非対応
