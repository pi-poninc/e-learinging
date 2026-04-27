-- ============================================
-- E-Learning MVP: Row Level Security Policies
-- ============================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.sections enable row level security;
alter table public.lessons enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;

-- ============================================
-- profiles
-- ============================================

-- Users can read their own profile
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Admin can read all profiles
create policy "Admin can read all profiles"
  on public.profiles for select
  using (public.get_user_role() in ('admin', 'instructor'));

-- Users can update their own profile (name only, not role)
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================
-- courses
-- ============================================

-- Published courses are readable by any authenticated user
create policy "Published courses are readable"
  on public.courses for select
  using (
    status = 'published'
    and auth.uid() is not null
  );

-- Admin/instructor can read all courses
create policy "Admin can read all courses"
  on public.courses for select
  using (public.get_user_role() in ('admin', 'instructor'));

-- Admin/instructor can create courses
create policy "Admin can create courses"
  on public.courses for insert
  with check (public.get_user_role() in ('admin', 'instructor'));

-- Admin/instructor can update courses
create policy "Admin can update courses"
  on public.courses for update
  using (public.get_user_role() in ('admin', 'instructor'));

-- Admin can delete courses
create policy "Admin can delete courses"
  on public.courses for delete
  using (public.get_user_role() = 'admin');

-- ============================================
-- sections
-- ============================================

-- Sections are readable if the parent course is readable
create policy "Sections readable if course readable"
  on public.sections for select
  using (
    exists (
      select 1 from public.courses c
      where c.id = course_id
      and (
        c.status = 'published'
        or public.get_user_role() in ('admin', 'instructor')
      )
    )
    and auth.uid() is not null
  );

-- Admin/instructor can create sections
create policy "Admin can create sections"
  on public.sections for insert
  with check (public.get_user_role() in ('admin', 'instructor'));

-- Admin/instructor can update sections
create policy "Admin can update sections"
  on public.sections for update
  using (public.get_user_role() in ('admin', 'instructor'));

-- Admin/instructor can delete sections
create policy "Admin can delete sections"
  on public.sections for delete
  using (public.get_user_role() in ('admin', 'instructor'));

-- ============================================
-- lessons
-- ============================================

-- Lessons are readable if user has enrollment or is admin/instructor
create policy "Lessons readable with access"
  on public.lessons for select
  using (
    auth.uid() is not null
    and (
      public.get_user_role() in ('admin', 'instructor')
      or (
        status = 'published'
        and exists (
          select 1 from public.sections s
          join public.courses c on c.id = s.course_id
          join public.enrollments e on e.course_id = c.id
          where s.id = section_id
          and e.user_id = auth.uid()
          and e.status = 'active'
        )
      )
    )
  );

-- Admin/instructor can create lessons
create policy "Admin can create lessons"
  on public.lessons for insert
  with check (public.get_user_role() in ('admin', 'instructor'));

-- Admin/instructor can update lessons
create policy "Admin can update lessons"
  on public.lessons for update
  using (public.get_user_role() in ('admin', 'instructor'));

-- Admin/instructor can delete lessons
create policy "Admin can delete lessons"
  on public.lessons for delete
  using (public.get_user_role() in ('admin', 'instructor'));

-- ============================================
-- enrollments
-- ============================================

-- Students can read their own enrollments
create policy "Students can read own enrollments"
  on public.enrollments for select
  using (auth.uid() = user_id);

-- Admin/instructor can read all enrollments
create policy "Admin can read all enrollments"
  on public.enrollments for select
  using (public.get_user_role() in ('admin', 'instructor'));

-- Admin/instructor can create enrollments
create policy "Admin can create enrollments"
  on public.enrollments for insert
  with check (public.get_user_role() in ('admin', 'instructor'));

-- Admin/instructor can update enrollments
create policy "Admin can update enrollments"
  on public.enrollments for update
  using (public.get_user_role() in ('admin', 'instructor'));

-- Admin/instructor can delete enrollments
create policy "Admin can delete enrollments"
  on public.enrollments for delete
  using (public.get_user_role() in ('admin', 'instructor'));

-- ============================================
-- lesson_progress
-- ============================================

-- Students can read their own progress
create policy "Students can read own progress"
  on public.lesson_progress for select
  using (auth.uid() = user_id);

-- Students can insert their own progress
create policy "Students can insert own progress"
  on public.lesson_progress for insert
  with check (auth.uid() = user_id);

-- Students can update their own progress
create policy "Students can update own progress"
  on public.lesson_progress for update
  using (auth.uid() = user_id);

-- Admin/instructor can read all progress
create policy "Admin can read all progress"
  on public.lesson_progress for select
  using (public.get_user_role() in ('admin', 'instructor'));
