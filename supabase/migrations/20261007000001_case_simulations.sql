-- ============================================
-- 案件シミュレーター (Case Simulator)
-- 実案件を「追体験」する分岐型インタラクティブ教材。
-- lessons / quizzes / assignments に次ぐ、section 配下の第4のコンテンツ種別。
-- 分岐シナリオ全体は case_simulations.scenario(jsonb) に格納する（script-driven authoring）。
-- ============================================

-- ============================================
-- case_simulations  … section 配下の「アイテム」行（quizzes と同じ立ち位置）
-- ============================================
create table public.case_simulations (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete cascade,
  title text not null,
  description text,
  scenario jsonb not null default '{}'::jsonb,  -- intro / roles / scenes / recap / next
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_case_simulations_section_id on public.case_simulations(section_id);

-- ============================================
-- case_attempts  … 受講者の完了記録（quiz_attempts と同じ立ち位置）
-- ============================================
create table public.case_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  case_simulation_id uuid not null references public.case_simulations(id) on delete cascade,
  completed boolean not null default false,
  path_taken jsonb not null default '[]'::jsonb,  -- 各局面で選んだ選択肢index
  score integer not null default 0,               -- 実際の判断と一致した数
  total integer not null default 0,               -- 局面数
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id, case_simulation_id)
);
create index idx_case_attempts_user_id on public.case_attempts(user_id);
create index idx_case_attempts_case_id on public.case_attempts(case_simulation_id);

-- updated_at triggers
create trigger set_updated_at before update on public.case_simulations
  for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.case_attempts
  for each row execute function public.update_updated_at();

-- ============================================
-- RLS
-- ============================================
alter table public.case_simulations enable row level security;
alter table public.case_attempts enable row level security;

-- case_simulations（lessons / quizzes と同じアクセスパターン）
create policy "Case sims readable with access" on public.case_simulations for select using (
  auth.uid() is not null and (
    public.get_user_role() in ('admin', 'instructor')
    or (
      status = 'published' and exists (
        select 1 from public.sections s
        join public.courses c on c.id = s.course_id
        join public.enrollments e on e.course_id = c.id
        where s.id = section_id and e.user_id = auth.uid() and e.status = 'active'
      )
    )
  )
);
create policy "Admin can manage case sims" on public.case_simulations for insert
  with check (public.get_user_role() in ('admin', 'instructor'));
create policy "Admin can update case sims" on public.case_simulations for update
  using (public.get_user_role() in ('admin', 'instructor'));
create policy "Admin can delete case sims" on public.case_simulations for delete
  using (public.get_user_role() in ('admin', 'instructor'));

-- case_attempts（quiz_attempts と同じ所有者パターン）
create policy "Students can read own case attempts" on public.case_attempts for select
  using (auth.uid() = user_id);
create policy "Students can insert own case attempts" on public.case_attempts for insert
  with check (auth.uid() = user_id);
create policy "Students can update own case attempts" on public.case_attempts for update
  using (auth.uid() = user_id);
create policy "Admin can read all case attempts" on public.case_attempts for select
  using (public.get_user_role() in ('admin', 'instructor'));
