# E-Learning MVP

Vimeo連携型のオンライン学習プラットフォーム。

## 技術スタック

- **フロントエンド**: Next.js 14 (App Router) + TypeScript
- **CSS**: Tailwind CSS
- **DB**: Supabase PostgreSQL
- **認証**: Supabase Auth
- **動画**: Vimeo Player SDK
- **デプロイ**: Render

## ローカル開発手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local` を作成（`.env.example` を参考に）:

```bash
cp .env.example .env.local
```

以下の値を設定:

| 変数名 | 説明 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | SupabaseプロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key |
| `NEXT_PUBLIC_APP_URL` | アプリケーションURL (`http://localhost:3000`) |

### 3. Supabase セットアップ

```bash
# Supabase CLIログイン
supabase login

# プロジェクトリンク
supabase link --project-ref <your-project-ref>

# マイグレーション適用
supabase db push

# シードデータ投入（任意）
# Supabase SQL Editorで supabase/seed.sql を実行
```

### 4. 開発サーバー起動

```bash
npm run dev
```

http://localhost:3000 でアクセス。

## 管理者ユーザーの作成

1. http://localhost:3000/signup でアカウントを作成
2. Supabase Dashboard > SQL Editor で以下を実行:

```sql
UPDATE profiles SET role = 'admin' WHERE id = '<作成したユーザーのUUID>';
```

3. ログインし直すと管理画面 `/admin` にアクセス可能

## Vimeo URL の登録

1. 管理画面で講座を作成
2. セクションを追加
3. レッスンを追加
4. レッスン編集画面で Vimeo URL を入力
   - 対応形式: `https://vimeo.com/123456789`
   - Video IDは自動抽出されます

## Render デプロイ手順

1. Render で新しい Web Service を作成
2. リポジトリを接続
3. 以下を設定:

| 項目 | 値 |
|------|-----|
| Build Command | `npm install && npm run build` |
| Start Command | `npm run start` |
| Node Version | 18+ |

4. 環境変数を設定（上記の表を参照）

## Supabase マイグレーション

```bash
# 新しいマイグレーション作成
supabase migration new <name>

# リモートDBに適用
supabase db push
```

## 今後追加予定の機能

- Stripe決済連携
- 修了証発行
- テスト・クイズ機能
- 法人アカウント対応
- メール通知
- 動画のダウンロード保護設定
