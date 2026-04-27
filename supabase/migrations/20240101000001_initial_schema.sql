-- ============================================
-- E-Learning MVP: Initial Schema
-- ============================================

-- ============================================
-- profiles
-- ============================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  role text not null default 'student' check (role in ('admin', 'instructor', 'student')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helper function to get current user's role
create or replace function public.get_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- courses
-- ============================================
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  thumbnail_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- sections
-- ============================================
create table public.sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- lessons
-- ============================================
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete cascade,
  title text not null,
  body text,
  vimeo_url text,
  vimeo_video_id text,
  duration_seconds integer,
  sort_order integer not null default 0,
  is_preview boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- enrollments
-- ============================================
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended', 'completed')),
  enrolled_at timestamptz not null default now(),
  unique(user_id, course_id)
);

-- ============================================
-- lesson_progress
-- ============================================
create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  watched_seconds integer not null default 0,
  progress_rate numeric not null default 0 check (progress_rate >= 0 and progress_rate <= 1),
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id, lesson_id)
);

-- ============================================
-- Indexes
-- ============================================
create index idx_sections_course_id on public.sections(course_id);
create index idx_lessons_section_id on public.lessons(section_id);
create index idx_enrollments_user_id on public.enrollments(user_id);
create index idx_enrollments_course_id on public.enrollments(course_id);
create index idx_lesson_progress_user_id on public.lesson_progress(user_id);
create index idx_lesson_progress_lesson_id on public.lesson_progress(lesson_id);

-- ============================================
-- updated_at trigger
-- ============================================
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.courses
  for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.sections
  for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.lessons
  for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.lesson_progress
  for each row execute function public.update_updated_at();
