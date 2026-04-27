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
