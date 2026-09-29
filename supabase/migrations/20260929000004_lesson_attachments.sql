-- ============================================
-- レッスン配布ファイル（実演・演習用の教材を受講者に配布）
-- ============================================

-- 公開バケット（配布教材。公開URLでそのままダウンロードできる）
insert into storage.buckets (id, name, public)
values ('lesson-files', 'lesson-files', true)
on conflict (id) do update set public = true;

create table if not exists public.lesson_attachments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  storage_path text,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.lesson_attachments enable row level security;

drop policy if exists "la_select_auth" on public.lesson_attachments;
create policy "la_select_auth" on public.lesson_attachments
  for select to authenticated using (true);

drop policy if exists "la_admin_all" on public.lesson_attachments;
create policy "la_admin_all" on public.lesson_attachments
  for all to authenticated
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');
