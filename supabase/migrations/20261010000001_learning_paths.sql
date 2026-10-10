-- ============================================
-- 学習ロードマップ（Learning Paths）＋ FDE育成
-- 複数の講座を「順番＋いつまでに」でまとめ、受講者が目標管理できるようにする。
-- FDEレベル(1-100)は既存の完了データから集計するため専用テーブルは持たない。
-- ============================================

create table public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- パスに含まれる講座（順番＋目安日数＋マイルストーン名）
create table public.path_items (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.learning_paths(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  sort_order integer not null default 0,
  target_days integer,                 -- パス開始から何日以内に完了する目安
  milestone_label text,                -- 例: 「基礎」「商売の型」「判断の型」
  created_at timestamptz not null default now()
);
create index idx_path_items_path_id on public.path_items(path_id);

-- 受講者のパス開始（いつ始めたか＝締切計算の基点）
create table public.path_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  path_id uuid not null references public.learning_paths(id) on delete cascade,
  started_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'completed')),
  unique(user_id, path_id)
);
create index idx_path_enrollments_user_id on public.path_enrollments(user_id);

create trigger set_updated_at before update on public.learning_paths
  for each row execute function public.update_updated_at();

-- ============================================
-- RLS
-- ============================================
alter table public.learning_paths enable row level security;
alter table public.path_items enable row level security;
alter table public.path_enrollments enable row level security;

create policy "Paths readable" on public.learning_paths for select using (
  auth.uid() is not null and (public.get_user_role() in ('admin','instructor') or status = 'published')
);
create policy "Admin manage paths" on public.learning_paths for insert
  with check (public.get_user_role() in ('admin','instructor'));
create policy "Admin update paths" on public.learning_paths for update
  using (public.get_user_role() in ('admin','instructor'));
create policy "Admin delete paths" on public.learning_paths for delete
  using (public.get_user_role() in ('admin','instructor'));

create policy "Path items readable" on public.path_items for select using (
  auth.uid() is not null and exists (
    select 1 from public.learning_paths p where p.id = path_id
      and (public.get_user_role() in ('admin','instructor') or p.status = 'published')
  )
);
create policy "Admin manage path items" on public.path_items for insert
  with check (public.get_user_role() in ('admin','instructor'));
create policy "Admin update path items" on public.path_items for update
  using (public.get_user_role() in ('admin','instructor'));
create policy "Admin delete path items" on public.path_items for delete
  using (public.get_user_role() in ('admin','instructor'));

create policy "Own path enrollments read" on public.path_enrollments for select
  using (auth.uid() = user_id);
create policy "Own path enrollments insert" on public.path_enrollments for insert
  with check (auth.uid() = user_id);
create policy "Own path enrollments update" on public.path_enrollments for update
  using (auth.uid() = user_id);
create policy "Admin read all path enrollments" on public.path_enrollments for select
  using (public.get_user_role() in ('admin','instructor'));
