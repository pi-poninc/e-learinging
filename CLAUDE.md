# E-Learning プロジェクト

## Supabase 設定

- **Project URL**: https://hxbiesgnijkmsbjxyzby.supabase.co
- **Publishable Key**: sb_publishable_WkTiOffAezO3X9kotzrGjQ_Gq1TBARy
- **PostgreSQL接続文字列**: postgresql://postgres:[YOUR-PASSWORD]@db.hxbiesgnijkmsbjxyzby.supabase.co:5432/postgres
- **Project Ref**: hxbiesgnijkmsbjxyzby

## セットアップ済み

- [x] Supabase CLI ログイン済み
- [x] `supabase init` 実行済み（`/supabase` ディレクトリ生成済み）
- [x] `supabase link --project-ref hxbiesgnijkmsbjxyzby` 実行済み
- [x] Next.js 16 (App Router) + TypeScript + Tailwind CSS
- [x] Supabase SDK (@supabase/supabase-js, @supabase/ssr)
- [x] Vimeo Player SDK (@vimeo/player)
- [x] DB schema migration (6テーブル: profiles, courses, sections, lessons, enrollments, lesson_progress)
- [x] RLS policies migration
- [x] Supabase client/server/middleware ヘルパー
- [x] 認証 (login/signup) + ロールベースMiddleware
- [x] 受講者ページ (dashboard, courses/[courseId], lessons/[lessonId])
- [x] 管理画面 (courses CRUD, lessons編集, enrollments管理, progress確認)
- [x] API Routes (lesson-progress, lesson-progress/complete, admin/enrollments)
- [x] Vimeo Playerコンポーネント (進捗自動保存、完了判定)
- [x] UIコンポーネント (Button, Input, Textarea, Select, Card, Badge, Table)
- [x] seed SQL
- [x] `npm run build` 成功確認済み

## 技術スタック

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS
- Supabase (PostgreSQL + Auth)
- @vimeo/player
- デプロイ先: Render

## 次のステップ

- [ ] `supabase db push` でマイグレーションをリモートDBに適用
- [ ] 管理者ユーザー作成 (signup後にprofiles.roleをadminに変更)
- [ ] 本番環境の環境変数設定 (SUPABASE_SERVICE_ROLE_KEY)
- [ ] Renderデプロイ
- [ ] Stripe決済連携（将来）
- [ ] 修了証発行（将来）
- [ ] テスト・クイズ機能（将来）

## コマンド

```bash
npm run dev      # 開発サーバー起動
npm run build    # プロダクションビルド
npm run start    # プロダクションサーバー起動
supabase db push # マイグレーション適用
```
