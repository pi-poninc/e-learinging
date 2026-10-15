-- 育成プログラム（第2弾）Phase B: 課題の段階化・ケース教材・時間制限・OJT
-- 追加のみ・破壊的変更なし。down は 20261015000003_assignment_staging_down.sql
-- 適用: supabase db query --linked -f supabase/migrations/20261015000003_assignment_staging.sql

-- ========================================================================
-- 1. ケース教材（実案件の匿名化教材）。機微情報は別テーブルに分離
-- ========================================================================
create table if not exists public.case_materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete set null,
  title text not null,
  background text,                              -- 匿名化済みの背景
  materials jsonb not null default '[]',        -- [{type,path,name}] ヒアリング録音・議事録・データ等
  anonymization_status text not null default 'draft' check (anonymization_status in ('draft','reviewed','approved')),
  anonymization_reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 機微情報（講師・管理者のみ。模範解答は提出後に別途開示）
create table if not exists public.case_material_private (
  case_material_id uuid primary key references public.case_materials(id) on delete cascade,
  model_answer text,                            -- 模範解答・講評（提出＆添削後にのみ開示）
  source_project_note text                      -- 元案件メモ（スタッフのみ）
);

-- ========================================================================
-- 2. review_tasks の段階化カラム（追加のみ）
-- ========================================================================
alter table public.review_tasks add column if not exists assignment_type text not null default 'drill'
  check (assignment_type in ('drill','case','timed_challenge','ojt','peer_review'));
alter table public.review_tasks add column if not exists target_skill_ids uuid[] not null default '{}';
alter table public.review_tasks add column if not exists difficulty_level int check (difficulty_level between 1 and 5);
alter table public.review_tasks add column if not exists time_limit_minutes int;
alter table public.review_tasks add column if not exists prerequisite_grade_id uuid references public.grades(id) on delete set null;
alter table public.review_tasks add column if not exists case_material_id uuid references public.case_materials(id) on delete set null;

-- ========================================================================
-- 3. 時間制限課題の「開始」記録（開始後に教材公開・残り時間計測）
-- ========================================================================
create table if not exists public.review_task_starts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.review_tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  unique (task_id, user_id)
);

-- ========================================================================
-- 4. OJT等の個別割り当て
-- ========================================================================
create table if not exists public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.review_tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (task_id, user_id)
);

-- ========================================================================
-- 5. 匿名化ゲート（DB側でも担保）：未承認ケース教材を使う課題は公開できない
-- ========================================================================
create or replace function public.review_task_anon_gate()
returns trigger language plpgsql as $$
begin
  if new.case_material_id is not null and new.is_active then
    if not exists (
      select 1 from public.case_materials cm
      where cm.id = new.case_material_id and cm.anonymization_status = 'approved'
    ) then
      raise exception '匿名化が承認されていないケース教材は公開できません (case_material_id=%)', new.case_material_id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists review_tasks_anon_gate on public.review_tasks;
create trigger review_tasks_anon_gate before insert or update on public.review_tasks
  for each row execute function public.review_task_anon_gate();

-- updated_at
drop trigger if exists case_materials_touch on public.case_materials;
create trigger case_materials_touch before update on public.case_materials
  for each row execute function public.review_touch_updated_at();

-- ========================================================================
-- RLS
-- ========================================================================
alter table public.case_materials         enable row level security;
alter table public.case_material_private  enable row level security;
alter table public.review_task_starts     enable row level security;
alter table public.task_assignments       enable row level security;

-- ケース教材本体：承認済みは認証ユーザが読める／スタッフは全操作
drop policy if exists case_materials_read on public.case_materials;
create policy case_materials_read on public.case_materials for select to authenticated
  using (anonymization_status = 'approved' or public.get_user_role() in ('admin','instructor','manager'));
drop policy if exists case_materials_staff on public.case_materials;
create policy case_materials_staff on public.case_materials for all to authenticated
  using (public.get_user_role() in ('admin','instructor','manager'))
  with check (public.get_user_role() in ('admin','instructor','manager'));

-- 機微情報：スタッフのみ
drop policy if exists case_material_private_staff on public.case_material_private;
create policy case_material_private_staff on public.case_material_private for all to authenticated
  using (public.get_user_role() in ('admin','instructor','manager'))
  with check (public.get_user_role() in ('admin','instructor','manager'));

-- 開始記録：本人＋スタッフ
drop policy if exists review_task_starts_own on public.review_task_starts;
create policy review_task_starts_own on public.review_task_starts for select to authenticated
  using (auth.uid() = user_id or public.get_user_role() in ('admin','instructor','manager'));
drop policy if exists review_task_starts_insert on public.review_task_starts;
create policy review_task_starts_insert on public.review_task_starts for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists review_task_starts_staff on public.review_task_starts;
create policy review_task_starts_staff on public.review_task_starts for all to authenticated
  using (public.get_user_role() in ('admin','instructor','manager'))
  with check (public.get_user_role() in ('admin','instructor','manager'));

-- 割り当て：本人＋スタッフが参照／スタッフが管理
drop policy if exists task_assignments_own on public.task_assignments;
create policy task_assignments_own on public.task_assignments for select to authenticated
  using (auth.uid() = user_id or public.get_user_role() in ('admin','instructor','manager'));
drop policy if exists task_assignments_staff on public.task_assignments;
create policy task_assignments_staff on public.task_assignments for all to authenticated
  using (public.get_user_role() in ('admin','instructor','manager'))
  with check (public.get_user_role() in ('admin','instructor','manager'));

-- ========================================================================
-- 6. review_tasks の閲覧ポリシー更新：OJTは割当者と本人・スタッフのみ
-- ========================================================================
drop policy if exists review_tasks_read on public.review_tasks;
create policy review_tasks_read on public.review_tasks for select to authenticated
  using (
    (is_active and assignment_type <> 'ojt')
    or exists (select 1 from public.task_assignments ta where ta.task_id = review_tasks.id and ta.user_id = auth.uid())
    or public.get_user_role() in ('admin','instructor','manager')
  );
