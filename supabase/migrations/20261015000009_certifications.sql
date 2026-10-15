-- 育成プログラム（第2弾）Phase F-1: 認定（pipon認定FDE 等）
-- 追加のみ・破壊的変更なし。down は _down.sql。既存 certificates(修了証) とは別物。
-- 適用: supabase db query --linked -f supabase/migrations/20261015000009_certifications.sql

create table if not exists public.certifications (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null,
  requirements jsonb not null default '{}',   -- { grade_level, required_task_ids[], demo_day }
  validity_months int,                         -- 有効期間（月）。null は無期限
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  certification_id uuid not null references public.certifications(id) on delete cascade,
  status text not null default 'eligible' check (status in ('eligible','approved','rejected','expired')),
  certificate_number text unique,              -- 発行時に採番
  issued_at timestamptz,
  expires_at timestamptz,
  evidence jsonb not null default '{}',
  public_consent boolean not null default false,  -- 公開確認ページへの掲載に本人が同意
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, certification_id)
);
create index if not exists user_certifications_user_idx on public.user_certifications(user_id);

-- RLS
alter table public.certifications enable row level security;
alter table public.user_certifications enable row level security;

drop policy if exists certifications_read on public.certifications;
create policy certifications_read on public.certifications for select to authenticated using (true);
drop policy if exists certifications_staff on public.certifications;
create policy certifications_staff on public.certifications for all to authenticated
  using (public.get_user_role() in ('admin','instructor','manager')) with check (public.get_user_role() in ('admin','instructor','manager'));

-- 本人は自分の認定を読める／スタッフが全操作（発行・承認）。本人の更新は許可しない（同意はAPIでservice経由）
drop policy if exists user_certifications_own on public.user_certifications;
create policy user_certifications_own on public.user_certifications for select to authenticated
  using (auth.uid() = user_id or public.get_user_role() in ('admin','instructor','manager'));
drop policy if exists user_certifications_staff on public.user_certifications;
create policy user_certifications_staff on public.user_certifications for all to authenticated
  using (public.get_user_role() in ('admin','instructor','manager')) with check (public.get_user_role() in ('admin','instructor','manager'));
