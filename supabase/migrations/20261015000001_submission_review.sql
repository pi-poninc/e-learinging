-- 提出 × 添削 × やり遂げる 機能（Phase 1 MVP の土台）
-- 既存の assignments / assignment_submissions には一切触れない。review_* の新ドメインを追加する。
-- すべて追加のみ・破壊的変更なし。down は 20261015000001_submission_review_down.sql。
-- 適用: supabase db query --linked -f supabase/migrations/20261015000001_submission_review.sql

-- ========================================================================
-- 1. コースごとの設定
-- ========================================================================
create table if not exists public.review_settings (
  course_id uuid primary key references public.courses(id) on delete cascade,
  daily_submission_limit int not null default 1,
  sla_hours int not null default 24,
  weekly_goal_days int not null default 7,
  day_boundary_hour int not null default 4,            -- 学習日の切り替え時刻（JST）
  timezone text not null default 'Asia/Tokyo',
  week_start text not null default 'monday' check (week_start in ('sunday','monday')),
  early_threshold_submissions int not null default 5,
  early_window_days int not null default 7,
  ai_draft_enabled boolean not null default false,
  reviewer_display_mode text not null default 'nickname' check (reviewer_display_mode in ('real_name','nickname','anonymous')),
  submit_encouragement text not null default '完璧でなくて大丈夫。今日の分を出すことが一番大事です。',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========================================================================
-- 2. 添削者プロフィール（受講者に見せる表示名・アイコン）
-- ========================================================================
create table if not exists public.reviewer_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  course_ids uuid[] not null default '{}',
  max_concurrent_claims int not null default 3,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========================================================================
-- 3. 課題（提出を求める単位）。既存 assignments とは別物。レッスン/コースに紐づく。
-- ========================================================================
create table if not exists public.review_tasks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  title text not null,
  instructions text,                                   -- markdown
  steps jsonb not null default '[]',                   -- 学習ステップ [{title,description,video_url}]
  submission_types text[] not null default '{text,url}', -- text/url/file/audio/video/code_repo
  pre_submit_checklist jsonb not null default '[]',    -- 提出前チェック項目
  estimated_minutes int,
  order_index int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists review_tasks_course_idx on public.review_tasks(course_id, order_index);

-- ========================================================================
-- 4. 提出（1日の上限は review_settings.daily_submission_limit。MVPは既定1）
-- ========================================================================
create table if not exists public.review_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.review_tasks(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade, -- 日次制限の判定用に非正規化
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft','submitted','in_review','reviewed','returned_for_resubmission')),
  content_text text,
  content_url text,
  attachments jsonb not null default '[]',             -- [{path,name,size,mime}]
  learning_day date,                                   -- 切り替え時刻を考慮した学習日（提出時に確定）
  submitted_at timestamptz,
  sla_due_at timestamptz,                              -- submitted_at + sla_hours
  submission_number int,                               -- その受講者の累計提出回数（提出時に確定）
  auto_check_result jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists review_submissions_user_idx on public.review_submissions(user_id, created_at desc);
create index if not exists review_submissions_queue_idx on public.review_submissions(course_id, status, sla_due_at);
-- 二重送信対策（既定1回/日/コース）: draft 以外は (user, course, learning_day) で1件まで。
-- DB 制約なので並行リクエストでも破れない。
create unique index if not exists review_submissions_daily_unique
  on public.review_submissions(user_id, course_id, learning_day)
  where status <> 'draft' and learning_day is not null;

-- ========================================================================
-- 5. 添削（1提出に1件）。claim→drafting→published。
-- ========================================================================
create table if not exists public.review_feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.review_submissions(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'claimed' check (status in ('claimed','drafting','published')),
  good_points text,
  improvements text,
  next_action text,
  inline_comments jsonb not null default '[]',
  rubric_scores jsonb not null default '{}',
  ai_draft jsonb,                                      -- 学習者には非表示（Phase4）
  claimed_at timestamptz not null default now(),
  published_at timestamptz,
  review_duration_seconds int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists review_feedback_reviewer_idx on public.review_feedback(reviewer_id, status);

-- ========================================================================
-- updated_at トリガ（既存の public.set_updated_at があればそれを使う。無ければ作る）
-- ========================================================================
create or replace function public.review_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['review_settings','reviewer_profiles','review_tasks','review_submissions','review_feedback'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.review_touch_updated_at()', t, t);
  end loop;
end $$;

-- ========================================================================
-- RLS（既存 assignment_submissions / content_submissions のパターンを踏襲）
-- 受講者=自分の提出/公開済み添削のみ。添削者=スタッフ(admin/instructor/manager)。
-- ========================================================================
alter table public.review_settings     enable row level security;
alter table public.reviewer_profiles   enable row level security;
alter table public.review_tasks         enable row level security;
alter table public.review_submissions   enable row level security;
alter table public.review_feedback      enable row level security;

-- review_settings: 認証ユーザは読める／スタッフが全操作
drop policy if exists review_settings_read on public.review_settings;
create policy review_settings_read on public.review_settings for select to authenticated using (true);
drop policy if exists review_settings_staff on public.review_settings;
create policy review_settings_staff on public.review_settings for all to authenticated
  using (public.get_user_role() in ('admin','instructor','manager'))
  with check (public.get_user_role() in ('admin','instructor','manager'));

-- reviewer_profiles: 認証ユーザは読める／本人は自分を更新／スタッフが全操作
drop policy if exists reviewer_profiles_read on public.reviewer_profiles;
create policy reviewer_profiles_read on public.reviewer_profiles for select to authenticated using (true);
drop policy if exists reviewer_profiles_self on public.reviewer_profiles;
create policy reviewer_profiles_self on public.reviewer_profiles for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists reviewer_profiles_staff on public.reviewer_profiles;
create policy reviewer_profiles_staff on public.reviewer_profiles for all to authenticated
  using (public.get_user_role() in ('admin','instructor','manager'))
  with check (public.get_user_role() in ('admin','instructor','manager'));

-- review_tasks: 公開中は認証ユーザが読める／スタッフが全操作
drop policy if exists review_tasks_read on public.review_tasks;
create policy review_tasks_read on public.review_tasks for select to authenticated
  using (is_active or public.get_user_role() in ('admin','instructor','manager'));
drop policy if exists review_tasks_staff on public.review_tasks;
create policy review_tasks_staff on public.review_tasks for all to authenticated
  using (public.get_user_role() in ('admin','instructor','manager'))
  with check (public.get_user_role() in ('admin','instructor','manager'));

-- review_submissions: 本人は自分の行を読/書／スタッフは全行
drop policy if exists review_submissions_own_read on public.review_submissions;
create policy review_submissions_own_read on public.review_submissions for select to authenticated
  using (auth.uid() = user_id or public.get_user_role() in ('admin','instructor','manager'));
drop policy if exists review_submissions_own_insert on public.review_submissions;
create policy review_submissions_own_insert on public.review_submissions for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists review_submissions_own_update on public.review_submissions;
create policy review_submissions_own_update on public.review_submissions for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists review_submissions_staff on public.review_submissions;
create policy review_submissions_staff on public.review_submissions for all to authenticated
  using (public.get_user_role() in ('admin','instructor','manager'))
  with check (public.get_user_role() in ('admin','instructor','manager'));

-- review_feedback: 受講者は「自分の提出に紐づく published」だけ読める／スタッフは全操作
drop policy if exists review_feedback_student_read on public.review_feedback;
create policy review_feedback_student_read on public.review_feedback for select to authenticated
  using (
    status = 'published'
    and exists (select 1 from public.review_submissions s
                where s.id = review_feedback.submission_id and s.user_id = auth.uid())
  );
drop policy if exists review_feedback_staff on public.review_feedback;
create policy review_feedback_staff on public.review_feedback for all to authenticated
  using (public.get_user_role() in ('admin','instructor','manager'))
  with check (public.get_user_role() in ('admin','instructor','manager'));
