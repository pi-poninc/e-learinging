-- 育成プログラム（第2弾）Phase E-1: コホート（期）と仲間（応援・タイムライン）
-- 追加のみ・破壊的変更なし。down は _down.sql。個人の順位は作らない（原則G1）。
-- 適用: supabase db query --linked -f supabase/migrations/20261015000007_cohorts.sql

create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  demo_day_at timestamptz,
  status text not null default 'active' check (status in ('planned','active','completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.cohort_members (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'learner' check (role in ('learner','mentor')),
  share_activity boolean not null default true,   -- タイムラインに自分の活動を出すか
  created_at timestamptz not null default now(),
  unique (cohort_id, user_id)
);
create index if not exists cohort_members_user_idx on public.cohort_members(user_id);

-- 応援リアクション（提出への「応援」。順位ではなく相互応援）
create table if not exists public.submission_cheers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.review_submissions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (submission_id, user_id)
);

-- ========================================================================
-- RLS
-- ========================================================================
alter table public.cohorts enable row level security;
alter table public.cohort_members enable row level security;
alter table public.submission_cheers enable row level security;

-- cohorts: 自分が所属する期、またはスタッフが読める／スタッフが全操作
drop policy if exists cohorts_read on public.cohorts;
create policy cohorts_read on public.cohorts for select to authenticated
  using (
    exists (select 1 from public.cohort_members m where m.cohort_id = cohorts.id and m.user_id = auth.uid())
    or public.get_user_role() in ('admin','instructor','manager')
  );
drop policy if exists cohorts_staff on public.cohorts;
create policy cohorts_staff on public.cohorts for all to authenticated
  using (public.get_user_role() in ('admin','instructor','manager'))
  with check (public.get_user_role() in ('admin','instructor','manager'));

-- cohort_members: 同じ期のメンバーは互いに参照可／本人は自分の設定を更新／スタッフ全操作
drop policy if exists cohort_members_read on public.cohort_members;
create policy cohort_members_read on public.cohort_members for select to authenticated
  using (
    exists (select 1 from public.cohort_members me where me.cohort_id = cohort_members.cohort_id and me.user_id = auth.uid())
    or public.get_user_role() in ('admin','instructor','manager')
  );
drop policy if exists cohort_members_self on public.cohort_members;
create policy cohort_members_self on public.cohort_members for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists cohort_members_staff on public.cohort_members;
create policy cohort_members_staff on public.cohort_members for all to authenticated
  using (public.get_user_role() in ('admin','instructor','manager'))
  with check (public.get_user_role() in ('admin','instructor','manager'));

-- submission_cheers: 本人が応援を追加／本人・スタッフが参照
drop policy if exists submission_cheers_insert on public.submission_cheers;
create policy submission_cheers_insert on public.submission_cheers for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists submission_cheers_read on public.submission_cheers;
create policy submission_cheers_read on public.submission_cheers for select to authenticated
  using (auth.uid() = user_id or public.get_user_role() in ('admin','instructor','manager'));
