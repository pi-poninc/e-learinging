-- 育成プログラム（第2弾）Phase E-2: デモデイ（発表・評価・ゲスト評価者の期限付きURL）
-- 追加のみ・破壊的変更なし。down は _down.sql
-- 適用: supabase db query --linked -f supabase/migrations/20261015000008_demo_day.sql

create table if not exists public.demo_day_entries (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  video_url text,
  demo_url text,
  slides_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cohort_id, user_id)
);

create table if not exists public.demo_day_evaluations (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.demo_day_entries(id) on delete cascade,
  evaluator_id uuid references public.profiles(id) on delete set null,  -- ゲストは null
  evaluator_type text not null check (evaluator_type in ('instructor','guest','peer')),
  scores jsonb not null default '{}',
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists demo_day_eval_entry_idx on public.demo_day_evaluations(entry_id);

-- ゲスト評価者用の期限付きトークン（ログイン不要URL）
create table if not exists public.demo_day_guest_tokens (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  token text not null unique,
  label text,
  expires_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

drop trigger if exists demo_day_entries_touch on public.demo_day_entries;
create trigger demo_day_entries_touch before update on public.demo_day_entries
  for each row execute function public.review_touch_updated_at();

-- ========================================================================
-- RLS（ゲスト経路はサービスロール＋トークン検証で扱うため、ここは認証ユーザ向け）
-- ========================================================================
alter table public.demo_day_entries enable row level security;
alter table public.demo_day_evaluations enable row level security;
alter table public.demo_day_guest_tokens enable row level security;

-- entries: 同じ期のメンバーは参照可／本人が自分の発表を作成・更新／スタッフ全操作
drop policy if exists demo_entries_read on public.demo_day_entries;
create policy demo_entries_read on public.demo_day_entries for select to authenticated
  using (
    exists (select 1 from public.cohort_members m where m.cohort_id = demo_day_entries.cohort_id and m.user_id = auth.uid())
    or public.get_user_role() in ('admin','instructor','manager')
  );
drop policy if exists demo_entries_own on public.demo_day_entries;
create policy demo_entries_own on public.demo_day_entries for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists demo_entries_own_update on public.demo_day_entries;
create policy demo_entries_own_update on public.demo_day_entries for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists demo_entries_staff on public.demo_day_entries;
create policy demo_entries_staff on public.demo_day_entries for all to authenticated
  using (public.get_user_role() in ('admin','instructor','manager')) with check (public.get_user_role() in ('admin','instructor','manager'));

-- evaluations: 発表の本人は自分への評価を読める／スタッフ全操作（講師評価の作成もここ）
drop policy if exists demo_eval_read on public.demo_day_evaluations;
create policy demo_eval_read on public.demo_day_evaluations for select to authenticated
  using (
    exists (select 1 from public.demo_day_entries e where e.id = demo_day_evaluations.entry_id and e.user_id = auth.uid())
    or public.get_user_role() in ('admin','instructor','manager')
  );
drop policy if exists demo_eval_staff on public.demo_day_evaluations;
create policy demo_eval_staff on public.demo_day_evaluations for all to authenticated
  using (public.get_user_role() in ('admin','instructor','manager')) with check (public.get_user_role() in ('admin','instructor','manager'));

-- guest tokens: スタッフのみ
drop policy if exists demo_guest_tokens_staff on public.demo_day_guest_tokens;
create policy demo_guest_tokens_staff on public.demo_day_guest_tokens for all to authenticated
  using (public.get_user_role() in ('admin','instructor','manager')) with check (public.get_user_role() in ('admin','instructor','manager'));
