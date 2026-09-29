-- ============================================
-- お知らせ配信 + 受講期限
-- ============================================

-- お知らせ（group_id が null なら全員向け、指定ありならそのグループ向け）
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  group_id uuid references public.groups(id) on delete cascade,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

drop policy if exists "ann_select" on public.announcements;
create policy "ann_select" on public.announcements
  for select to authenticated
  using (
    group_id is null
    or group_id in (select group_id from public.profiles where id = auth.uid())
    or public.get_user_role() = 'admin'
  );

drop policy if exists "ann_admin_all" on public.announcements;
create policy "ann_admin_all" on public.announcements
  for all to authenticated
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');

-- 受講期限（enrollment 単位）
alter table public.enrollments add column if not exists due_date date;
