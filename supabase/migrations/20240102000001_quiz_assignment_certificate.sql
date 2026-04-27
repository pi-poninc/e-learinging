-- ============================================
-- E-Learning: Quiz, Assignment, Certificate tables
-- ============================================

-- Add sequential mode to courses
alter table public.courses add column is_sequential boolean not null default false;

-- ============================================
-- quizzes
-- ============================================
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete cascade,
  title text not null,
  description text,
  passing_score integer not null default 80,
  sort_order integer not null default 0,
  time_limit_minutes integer,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_quizzes_section_id on public.quizzes(section_id);

-- ============================================
-- quiz_questions
-- ============================================
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_type text not null check (question_type in ('single_choice', 'multiple_choice', 'true_false', 'ordering')),
  question_text text not null,
  explanation text,
  sort_order integer not null default 0,
  points integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_quiz_questions_quiz_id on public.quiz_questions(quiz_id);

-- ============================================
-- quiz_options
-- ============================================
create table public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  option_text text not null,
  is_correct boolean not null default false,
  correct_position integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index idx_quiz_options_question_id on public.quiz_options(question_id);

-- ============================================
-- quiz_attempts
-- ============================================
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  score integer not null default 0,
  total_points integer not null default 0,
  earned_points integer not null default 0,
  passed boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index idx_quiz_attempts_user_id on public.quiz_attempts(user_id);
create index idx_quiz_attempts_quiz_id on public.quiz_attempts(quiz_id);

-- ============================================
-- quiz_answers
-- ============================================
create table public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  selected_option_ids uuid[] not null default '{}',
  ordering_result uuid[] not null default '{}',
  is_correct boolean not null default false,
  points_earned integer not null default 0,
  created_at timestamptz not null default now()
);
create index idx_quiz_answers_attempt_id on public.quiz_answers(attempt_id);

-- ============================================
-- assignments
-- ============================================
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete cascade,
  title text not null,
  description text,
  sort_order integer not null default 0,
  max_file_size_mb integer not null default 10,
  allowed_file_types text[] not null default '{pdf,doc,docx,ppt,pptx,zip}',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_assignments_section_id on public.assignments(section_id);

-- ============================================
-- assignment_submissions
-- ============================================
create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  file_size_bytes integer,
  comment text,
  status text not null default 'submitted' check (status in ('submitted', 'reviewed', 'approved', 'rejected')),
  grade integer,
  feedback text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique(user_id, assignment_id)
);
create index idx_submissions_user_id on public.assignment_submissions(user_id);
create index idx_submissions_assignment_id on public.assignment_submissions(assignment_id);

-- ============================================
-- certificates
-- ============================================
create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  certificate_number text not null unique,
  issued_at timestamptz not null default now(),
  pdf_url text,
  unique(user_id, course_id)
);
create index idx_certificates_user_id on public.certificates(user_id);
create index idx_certificates_course_id on public.certificates(course_id);

-- Certificate number auto-generation
create or replace function public.generate_certificate_number()
returns trigger
language plpgsql
as $$
declare
  next_num integer;
begin
  select coalesce(max(
    cast(split_part(certificate_number, '-', 3) as integer)
  ), 0) + 1
  into next_num
  from public.certificates
  where certificate_number like 'CERT-' || to_char(now(), 'YYYY') || '-%';

  new.certificate_number := 'CERT-' || to_char(now(), 'YYYY') || '-' || lpad(next_num::text, 5, '0');
  return new;
end;
$$;

create trigger set_certificate_number
  before insert on public.certificates
  for each row execute function public.generate_certificate_number();

-- updated_at triggers
create trigger set_updated_at before update on public.quizzes
  for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.quiz_questions
  for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.assignments
  for each row execute function public.update_updated_at();

-- ============================================
-- Supabase Storage bucket for assignments
-- ============================================
insert into storage.buckets (id, name, public)
values ('assignment-files', 'assignment-files', false)
on conflict (id) do nothing;
