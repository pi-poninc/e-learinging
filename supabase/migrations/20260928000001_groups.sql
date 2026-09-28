-- ============================================
-- groups（組織・部署・グループ）＋ profiles.group_id
-- 社内利用向けのシンプル運用：1ユーザー1グループ
-- ============================================
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists group_id uuid references public.groups(id) on delete set null;

-- RLS（書き込みは管理者。閲覧は認証ユーザー。API側はservice roleで実行するのでRLSはバイパスされる）
alter table public.groups enable row level security;

drop policy if exists "groups_select_auth" on public.groups;
create policy "groups_select_auth" on public.groups
  for select to authenticated using (true);

drop policy if exists "groups_admin_all" on public.groups;
create policy "groups_admin_all" on public.groups
  for all to authenticated
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');
