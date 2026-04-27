# Lessons Learned - E-Learning プロジェクト

## 1. Supabase SSR Middleware のリダイレクトループ

### 問題
`/login` と `/dashboard` の間で無限リダイレクトが発生した（ERR_TOO_MANY_REDIRECTS）。

### 原因
`@supabase/ssr` の `createServerClient` は `getUser()` を呼ぶと内部でcookieを更新する（セッションのリフレッシュ等）。
しかし、`NextResponse.redirect()` を返す際に、`supabaseResponse` に設定されたcookieが **リダイレクトレスポンスにコピーされていなかった**。

**結果:**
1. `/login` を訪問 → `getUser()` がcookieを更新 → 古いcookieの状態で「ログイン済み」と誤判定 → `/dashboard` へリダイレクト（cookieなし）
2. `/dashboard` を訪問 → `getUser()` が新しいリクエストではcookieがない → 「未認証」と判定 → `/login` へリダイレクト
3. ループ

### 修正
```typescript
// NG: cookieが引き継がれない
return NextResponse.redirect(url)

// OK: supabaseResponseのcookieをコピーする
const redirectResponse = NextResponse.redirect(url)
supabaseResponse.cookies.getAll().forEach((cookie) => {
  redirectResponse.cookies.set(cookie.name, cookie.value)
})
return redirectResponse
```

### 教訓
- **Supabase SSR middleware では、どのレスポンス（redirect含む）を返す場合でも、必ずcookieを引き継ぐこと**
- `getUser()` の `error` も必ずチェックする（errorがある場合は未認証として扱う）
- API routes は middleware の matcher から除外する（認証はRoute Handler内で行う）

## 2. useCallback + createClient() の無限ループ

### 問題
管理画面のクライアントコンポーネントで、`createClient()` を component body で呼び、`useCallback` の依存配列に入れると、毎レンダーで新しい参照が生成されて無限ループになる可能性があった。

### 修正
```typescript
// NG
const supabase = createClient()
const loadData = useCallback(async () => { ... }, [supabase]) // 毎回新しい参照

// OK
const supabase = useMemo(() => createClient(), [])
const loadData = useCallback(async () => { ... }, [supabase]) // 安定した参照
```

## 3. Supabase の深いネストクエリは避ける

### 問題
```typescript
// 動かないことがある
.select('id, lesson:lessons!inner(section:sections!inner(course_id))')
.eq('lessons.sections.course_id', courseId)
```

### 修正
段階的にクエリを分割する：
```typescript
// 1. まずセクションIDを取得
const { data: sections } = await supabase.from('sections').select('id').eq('course_id', courseId)
// 2. 次にレッスンIDを取得
const { data: lessons } = await supabase.from('lessons').select('id').in('section_id', sectionIds)
// 3. 最後に進捗を取得
const { count } = await supabase.from('lesson_progress').select('id', { count: 'exact' }).in('lesson_id', lessonIds)
```

## 4. Migration の関数定義順序

### 問題
`get_user_role()` 関数が `profiles` テーブルより先に定義されていて、`supabase db push` がエラーになった。

### 教訓
SQL migration では、参照先のテーブルを先に作成してから関数を定義すること。

## 5. Render デプロイ時の Node.js バージョン

### 問題
Render がデフォルトで Node.js 24.x を使用し、ビルドが失敗した。

### 原因
- `package.json` に `engines` フィールドがなかった
- `.node-version` ファイルがなかった
- Node 24 は Next.js 16 との互換性が不安定

### 修正
```json
// package.json
"engines": { "node": "20.x" }
```
```
// .node-version
20.11.1
```

### 教訓
- Render にデプロイする場合は必ず Node.js バージョンを明示的に指定する
- `@types/node` のバージョンと合わせる（`^20` なら Node 20.x）
- Render の環境変数に `NEXT_PUBLIC_SUPABASE_URL` 等を事前に設定しておくこと

## 6. Supabase Auth の profiles 自動作成トリガーが動かない場合

### 問題
signup 後に `profiles` テーブルにレコードが作成されず、ダッシュボードが表示されなかった。

### 原因
マイグレーション適用前にユーザーを作成した場合、`handle_new_user` トリガーが存在しないためプロフィールが作成されない。

### 修正
`lib/auth.ts` の `getUserProfile()` にフォールバックを追加：
```typescript
if (!profile) {
  // Trigger didn't fire — return fallback
  return { id: user.id, name: user.email || null, role: 'student' }
}
```

### 教訓
- DBトリガーに依存する場合、トリガーが動かないケースも想定してアプリ側にフォールバックを入れる
- `single()` ではなく `maybeSingle()` を使い、0件の場合もエラーにしない

## 7. Vimeo API 連携

### ポイント
- Vimeo API Access Token は https://developer.vimeo.com/apps で取得
- Personal Access Token で十分（OAuth不要）
- スコープ: `public` と `private` が必要（自分の動画を取得するため）
- `VIMEO_ACCESS_TOKEN` をサーバーサイドのみで使用（クライアントに漏洩させない）
- APIレート制限: 1分あたり100リクエスト

## 8. Render CLI で環境変数を設定する方法

### 問題
`render` CLIには環境変数を直接設定するサブコマンドがない。

### 解決方法
Render API を curl で直接叩く：
```bash
RENDER_API_KEY="$(cat ~/.config/render/cli.yaml | grep 'key:' | head -1 | awk '{print $2}')"
SERVICE_ID="srv-xxxxx"

curl -X PUT "https://api.render.com/v1/services/${SERVICE_ID}/env-vars" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '[{"key": "KEY_NAME", "value": "value"}]'
```

### 教訓
- Render CLI のAPIキーは `~/.config/render/cli.yaml` に保存されている
- 環境変数設定は `PUT /v1/services/{id}/env-vars` で一括設定（上書き）
- デプロイトリガーは `render deploys create {service-id} --confirm`
- Render にデプロイする前に**必ず環境変数を先に設定する**（ビルド時に必要な `NEXT_PUBLIC_*` が無いと失敗する）

## 9. Render サービスの管理情報

- **Service ID**: srv-d7nes9ipmmbs73cfem2g
- **Dashboard**: https://dashboard.render.com/web/srv-d7nes9ipmmbs73cfem2g
- **URL**: https://e-learinging.onrender.com
- デプロイは GitHub push 時に自動（auto-deploy: yes）
