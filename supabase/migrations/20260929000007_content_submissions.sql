-- ネタ投稿（メンバーが仕事のネタを投げ、管理側で動画化キューとして扱う）
create table if not exists public.content_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  reference_url text,
  status text not null default 'new' check (status in ('new','in_progress','done','rejected')),
  admin_note text,
  course_id uuid references public.courses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_submissions enable row level security;

drop policy if exists "sub_own_select" on public.content_submissions;
create policy "sub_own_select" on public.content_submissions
  for select to authenticated using (user_id = auth.uid() or public.get_user_role() = 'admin');

drop policy if exists "sub_own_insert" on public.content_submissions;
create policy "sub_own_insert" on public.content_submissions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "sub_admin_all" on public.content_submissions;
create policy "sub_admin_all" on public.content_submissions
  for all to authenticated
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');
