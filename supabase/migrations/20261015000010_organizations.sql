-- 育成プログラム（第2弾）Phase F-2: 企業（組織）管理（外部研修として販売する前提）
-- 追加のみ・破壊的変更なし。down は _down.sql
-- 適用: supabase db query --linked -f supabase/migrations/20261015000010_organizations.sql

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text,
  contract_start date,
  contract_end date,
  show_submission_content boolean not null default false,  -- 契約設定: 企業管理者に提出物の中身を見せるか（既定 非表示）
  show_coach_logs boolean not null default false,          -- 契約設定: AIコーチの会話を見せるか（既定 非表示）
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'learner' check (role in ('org_admin','learner')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index if not exists organization_members_user_idx on public.organization_members(user_id);
create index if not exists organization_members_org_idx on public.organization_members(organization_id);

-- RLS
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

-- organizations: 自社メンバーは参照可／プラットフォームのスタッフが全操作
drop policy if exists organizations_read on public.organizations;
create policy organizations_read on public.organizations for select to authenticated
  using (
    exists (select 1 from public.organization_members m where m.organization_id = organizations.id and m.user_id = auth.uid())
    or public.get_user_role() in ('admin','instructor','manager')
  );
drop policy if exists organizations_staff on public.organizations;
create policy organizations_staff on public.organizations for all to authenticated
  using (public.get_user_role() in ('admin','instructor','manager')) with check (public.get_user_role() in ('admin','instructor','manager'));

-- organization_members: 同じ組織のメンバーは参照可／プラットフォームのスタッフが全操作
drop policy if exists organization_members_read on public.organization_members;
create policy organization_members_read on public.organization_members for select to authenticated
  using (
    exists (select 1 from public.organization_members me where me.organization_id = organization_members.organization_id and me.user_id = auth.uid())
    or public.get_user_role() in ('admin','instructor','manager')
  );
drop policy if exists organization_members_staff on public.organization_members;
create policy organization_members_staff on public.organization_members for all to authenticated
  using (public.get_user_role() in ('admin','instructor','manager')) with check (public.get_user_role() in ('admin','instructor','manager'));
