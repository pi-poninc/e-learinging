-- 育成プログラム（第2弾）Phase A: スキルマップ＆グレード ＋ 最小前提(learning_events, rubrics)
-- 追加のみ・破壊的変更なし。down は 20261015000002_skill_map_grade_down.sql。
-- 適用: supabase db query --linked -f supabase/migrations/20261015000002_skill_map_grade.sql

-- ========================================================================
-- 0. 最小前提: イベントログ（成長の根拠・KPI・再計算の土台）
-- ========================================================================
create table if not exists public.learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  event_name text not null,
  properties jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);
create index if not exists learning_events_user_idx on public.learning_events(user_id, occurred_at desc);
create index if not exists learning_events_name_idx on public.learning_events(event_name, occurred_at desc);

-- ========================================================================
-- 1. スキルマップ定義（バージョン管理）
-- ========================================================================
create table if not exists public.skill_maps (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null,
  version int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  skill_map_id uuid not null references public.skill_maps(id) on delete cascade,
  category text not null,
  name text not null,
  description text,
  order_index int not null default 0
);
create index if not exists skills_map_idx on public.skills(skill_map_id, order_index);

create table if not exists public.skill_levels (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills(id) on delete cascade,
  level int not null check (level between 1 and 5),
  behavior_description text,
  unique (skill_id, level)
);

-- ========================================================================
-- 2. ルーブリック（最小前提。項目をスキルに紐づける）
-- ========================================================================
create table if not exists public.rubrics (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.rubric_items (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references public.rubrics(id) on delete cascade,
  label text not null,
  skill_id uuid references public.skills(id) on delete set null,  -- どのスキルを評価するか
  weight numeric not null default 1.0,                            -- スキルレベル算出時の重み
  max_level int not null default 5,
  order_index int not null default 0
);
create index if not exists rubric_items_rubric_idx on public.rubric_items(rubric_id, order_index);

-- review_tasks にルーブリック参照を追加（既存列は変更しない）
alter table public.review_tasks add column if not exists rubric_id uuid references public.rubrics(id) on delete set null;

-- ========================================================================
-- 3. スキル評価の記録 → 現在レベル（集計・再計算可能）
-- ========================================================================
create table if not exists public.skill_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  source_type text not null check (source_type in ('review','peer_review','case_assignment','demo_day','manual')),
  source_id uuid,
  level_observed numeric not null,
  assessed_by uuid references public.profiles(id) on delete set null,
  assessed_at timestamptz not null default now()
);
create index if not exists skill_assessments_user_skill_idx on public.skill_assessments(user_id, skill_id, assessed_at desc);

create table if not exists public.user_skill_levels (
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  current_level numeric not null,
  confidence text not null default 'low' check (confidence in ('low','medium','high')),
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

-- ========================================================================
-- 4. グレード（自動昇格しない。eligible→講師が approved）
-- ========================================================================
create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  level int not null,
  name text not null,
  requirements jsonb not null default '{}',   -- { skill_id: 必要レベル }
  order_index int not null default 0,
  unique (course_id, level)
);

create table if not exists public.user_grades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  grade_id uuid not null references public.grades(id) on delete cascade,
  status text not null default 'eligible' check (status in ('eligible','approved','rejected')),
  evidence jsonb not null default '{}',
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, grade_id)
);

-- ========================================================================
-- RLS（認証ユーザは定義を読める。評価・レベル・グレードは本人＋スタッフ。書込はスタッフ）
-- ========================================================================
do $$
declare t text;
begin
  foreach t in array array['learning_events','skill_maps','skills','skill_levels','rubrics','rubric_items','skill_assessments','user_skill_levels','grades','user_grades'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- 定義系: 認証ユーザ読み取り / スタッフ全操作
do $$
declare t text;
begin
  foreach t in array array['skill_maps','skills','skill_levels','rubrics','rubric_items','grades'] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('create policy %I_read on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists %I_staff on public.%I', t, t);
    execute format($p$create policy %I_staff on public.%I for all to authenticated using (public.get_user_role() in ('admin','instructor','manager')) with check (public.get_user_role() in ('admin','instructor','manager'))$p$, t, t);
  end loop;
end $$;

-- 本人データ系: 本人は自分の行を読める / スタッフ全操作
do $$
declare t text;
begin
  foreach t in array array['learning_events','skill_assessments','user_skill_levels','user_grades'] loop
    execute format('drop policy if exists %I_own on public.%I', t, t);
    execute format('create policy %I_own on public.%I for select to authenticated using (auth.uid() = user_id or public.get_user_role() in (''admin'',''instructor'',''manager''))', t, t);
    execute format('drop policy if exists %I_staff on public.%I', t, t);
    execute format($p$create policy %I_staff on public.%I for all to authenticated using (public.get_user_role() in ('admin','instructor','manager')) with check (public.get_user_role() in ('admin','instructor','manager'))$p$, t, t);
  end loop;
end $$;

-- learning_events は本人による追加も許可（自分の行動ログ）
drop policy if exists learning_events_own_insert on public.learning_events;
create policy learning_events_own_insert on public.learning_events for insert to authenticated
  with check (auth.uid() = user_id or public.get_user_role() in ('admin','instructor','manager'));
