-- 育成プログラム（第2弾）Phase C: ピアレビュー ＋ 添削者の育成（新任はベテラン確認）
-- 追加のみ・破壊的変更なし（status の check は拡張）。down は _down.sql
-- 適用: supabase db query --linked -f supabase/migrations/20261015000004_peer_review.sql

-- ========================================================================
-- 1. 設定の追加（ピアレビュー開始グレード・新任確認件数）
-- ========================================================================
alter table public.review_settings add column if not exists peer_review_min_grade int not null default 3;
alter table public.review_settings add column if not exists new_reviewer_check_count int not null default 10;

-- 添削者プロフィール：新任の「公開前ベテラン確認」の残り件数
alter table public.reviewer_profiles add column if not exists needs_approval_remaining int not null default 0;

-- ========================================================================
-- 2. review_feedback：pending_approval 状態 ＋ ベテラン確認カラム
-- ========================================================================
alter table public.review_feedback add column if not exists veteran_checked_by uuid references public.profiles(id) on delete set null;
alter table public.review_feedback add column if not exists veteran_checked_at timestamptz;
alter table public.review_feedback drop constraint if exists review_feedback_status_check;
alter table public.review_feedback add constraint review_feedback_status_check
  check (status in ('claimed','drafting','published','pending_approval'));

-- ========================================================================
-- 3. ピアレビュー（仲間からのコメント。講師添削とは別枠）
-- ========================================================================
create table if not exists public.peer_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.review_submissions(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'submitted' check (status in ('submitted')),
  good_points text,
  comment text,
  helpfulness int check (helpfulness between 1 and 3),  -- 講師による「役に立った度」
  helpfulness_comment text,
  reviewee_reaction boolean not null default false,      -- 受講者の「参考になった」
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, reviewer_id)
);
create index if not exists peer_reviews_reviewer_idx on public.peer_reviews(reviewer_id);
create index if not exists peer_reviews_submission_idx on public.peer_reviews(submission_id);

drop trigger if exists peer_reviews_touch on public.peer_reviews;
create trigger peer_reviews_touch before update on public.peer_reviews
  for each row execute function public.review_touch_updated_at();

-- ========================================================================
-- RLS
-- ========================================================================
alter table public.peer_reviews enable row level security;

-- ピアレビュアー本人：自分の書いたものを読/書
drop policy if exists peer_reviews_reviewer on public.peer_reviews;
create policy peer_reviews_reviewer on public.peer_reviews for select to authenticated
  using (auth.uid() = reviewer_id or public.get_user_role() in ('admin','instructor','manager'));
drop policy if exists peer_reviews_reviewer_insert on public.peer_reviews;
create policy peer_reviews_reviewer_insert on public.peer_reviews for insert to authenticated
  with check (auth.uid() = reviewer_id);
drop policy if exists peer_reviews_reviewer_update on public.peer_reviews;
create policy peer_reviews_reviewer_update on public.peer_reviews for update to authenticated
  using (auth.uid() = reviewer_id) with check (auth.uid() = reviewer_id);

-- 提出の持ち主（受講者）：自分の提出に付いたピアレビューを読む／「参考になった」を更新
drop policy if exists peer_reviews_reviewee_read on public.peer_reviews;
create policy peer_reviews_reviewee_read on public.peer_reviews for select to authenticated
  using (exists (select 1 from public.review_submissions s where s.id = peer_reviews.submission_id and s.user_id = auth.uid()));
drop policy if exists peer_reviews_reviewee_react on public.peer_reviews;
create policy peer_reviews_reviewee_react on public.peer_reviews for update to authenticated
  using (exists (select 1 from public.review_submissions s where s.id = peer_reviews.submission_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.review_submissions s where s.id = peer_reviews.submission_id and s.user_id = auth.uid()));

-- スタッフ：全操作
drop policy if exists peer_reviews_staff on public.peer_reviews;
create policy peer_reviews_staff on public.peer_reviews for all to authenticated
  using (public.get_user_role() in ('admin','instructor','manager'))
  with check (public.get_user_role() in ('admin','instructor','manager'));
