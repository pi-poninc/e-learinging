# E-Learning Platform

Vimeo連携型のオンライン学習プラットフォーム。テスト/クイズ、課題提出、修了証発行、受講制御を備えたフル機能LMS。

## 機能

- **動画レッスン**: Vimeo Player SDK + API連携（メタデータ自動取得）
- **テスト/クイズ**: 4種類の問題形式（単一選択/複数選択/○×/並び替え）
- **課題提出**: ファイルアップロード + 管理者採点
- **修了証**: コース100%完了時にPDF自動生成
- **受講制御**: 順序モードで前のコンテンツ完了が必須
- **ロールベースアクセス**: admin / instructor / student

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フロントエンド | Next.js 16 (App Router) + TypeScript |
| CSS | Tailwind CSS |
| DB / 認証 | Supabase (PostgreSQL + Auth + Storage) |
| 動画 | Vimeo Player SDK + Vimeo API |
| PDF | jsPDF |
| デプロイ | Render (Node 20.x) |

## ローカル開発手順

### 1. セットアップ

```bash
npm install
cp .env.example .env.local  # 環境変数を編集
```

### 2. 環境変数

| 変数名 | 説明 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key (publishable key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` |
| `VIMEO_ACCESS_TOKEN` | Vimeo API Access Token |

### 3. Supabase

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push  # マイグレーション適用
```

### 4. 開発サーバー

```bash
npm run dev
```

### 5. 管理者ユーザー作成

```bash
# signupでアカウント作成後:
supabase db query --linked "UPDATE profiles SET role = 'admin' WHERE id = '<UUID>';"
```

## Vimeo連携

### Vimeo API Access Token の取得

1. https://developer.vimeo.com/apps にアクセス
2. アプリを作成（または既存アプリを選択）
3. 「Authentication」タブで Personal Access Token を生成
4. スコープ: `public`, `private` を選択
5. `.env.local` の `VIMEO_ACCESS_TOKEN` に設定

### 使い方

- レッスン編集画面で Vimeo URL を入力
- 「Vimeoから情報を取得」ボタンでタイトルと動画時間が自動入力される
- API: `GET /api/vimeo/videos` でアカウント内の動画一覧を取得
- API: `GET /api/vimeo/meta?url=<vimeo-url>` で動画メタデータを取得

## Render デプロイ手順

1. Render で新しい Web Service を作成
2. GitHub リポジトリ `pi-poninc/e-learinging` を接続
3. 以下を設定:

| 項目 | 値 |
|------|-----|
| Build Command | `npm install && npm run build` |
| Start Command | `npm run start` |
| Node Version | 自動検出 (`.node-version` で 20.x を指定済み) |

4. 環境変数を全て設定:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` (RenderのサービスURL)
   - `VIMEO_ACCESS_TOKEN`

## DB テーブル一覧 (14)

| テーブル | 説明 |
|---------|------|
| profiles | ユーザープロフィール（role: admin/instructor/student） |
| courses | 講座（is_sequential: 順序モード） |
| sections | セクション |
| lessons | レッスン（Vimeo動画） |
| enrollments | 受講登録 |
| lesson_progress | レッスン視聴進捗 |
| quizzes | テスト/クイズ |
| quiz_questions | 問題 |
| quiz_options | 選択肢 |
| quiz_attempts | テスト受験記録 |
| quiz_answers | 回答記録 |
| assignments | 課題 |
| assignment_submissions | 課題提出 |
| certificates | 修了証 |

## 今後追加予定

- Stripe決済連携
- 法人アカウント対応
- メール通知
- ディスカッション/コメント機能
