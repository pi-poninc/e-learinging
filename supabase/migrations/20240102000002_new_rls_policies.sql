-- ============================================
-- RLS for Quiz, Assignment, Certificate tables
-- ============================================

alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.certificates enable row level security;

-- ============================================
-- quizzes (same pattern as lessons)
-- ============================================
create policy "Quizzes readable with access" on public.quizzes for select using (
  auth.uid() is not null and (
    public.get_user_role() in ('admin', 'instructor')
    or (
      status = 'published' and exists (
        select 1 from public.sections s
        join public.courses c on c.id = s.course_id
        join public.enrollments e on e.course_id = c.id
        where s.id = section_id and e.user_id = auth.uid() and e.status = 'active'
      )
    )
  )
);
create policy "Admin can manage quizzes" on public.quizzes for insert
  with check (public.get_user_role() in ('admin', 'instructor'));
create policy "Admin can update quizzes" on public.quizzes for update
  using (public.get_user_role() in ('admin', 'instructor'));
create policy "Admin can delete quizzes" on public.quizzes for delete
  using (public.get_user_role() in ('admin', 'instructor'));

-- ============================================
-- quiz_questions
-- ============================================
create policy "Quiz questions readable with quiz access" on public.quiz_questions for select using (
  auth.uid() is not null and exists (
    select 1 from public.quizzes q where q.id = quiz_id
  )
);
create policy "Admin can manage quiz questions" on public.quiz_questions for insert
  with check (public.get_user_role() in ('admin', 'instructor'));
create policy "Admin can update quiz questions" on public.quiz_questions for update
  using (public.get_user_role() in ('admin', 'instructor'));
create policy "Admin can delete quiz questions" on public.quiz_questions for delete
  using (public.get_user_role() in ('admin', 'instructor'));

-- ============================================
-- quiz_options
-- ============================================
create policy "Quiz options readable with question access" on public.quiz_options for select using (
  auth.uid() is not null and exists (
    select 1 from public.quiz_questions qq where qq.id = question_id
  )
);
create policy "Admin can manage quiz options" on public.quiz_options for insert
  with check (public.get_user_role() in ('admin', 'instructor'));
create policy "Admin can update quiz options" on public.quiz_options for update
  using (public.get_user_role() in ('admin', 'instructor'));
create policy "Admin can delete quiz options" on public.quiz_options for delete
  using (public.get_user_role() in ('admin', 'instructor'));

-- ============================================
-- quiz_attempts
-- ============================================
create policy "Students can read own attempts" on public.quiz_attempts for select
  using (auth.uid() = user_id);
create policy "Students can insert own attempts" on public.quiz_attempts for insert
  with check (auth.uid() = user_id);
create policy "Admin can read all attempts" on public.quiz_attempts for select
  using (public.get_user_role() in ('admin', 'instructor'));

-- ============================================
-- quiz_answers
-- ============================================
create policy "Students can read own answers" on public.quiz_answers for select using (
  exists (select 1 from public.quiz_attempts qa where qa.id = attempt_id and qa.user_id = auth.uid())
);
create policy "Students can insert own answers" on public.quiz_answers for insert with check (
  exists (select 1 from public.quiz_attempts qa where qa.id = attempt_id and qa.user_id = auth.uid())
);
create policy "Admin can read all answers" on public.quiz_answers for select
  using (public.get_user_role() in ('admin', 'instructor'));

-- ============================================
-- assignments (same pattern as lessons)
-- ============================================
create policy "Assignments readable with access" on public.assignments for select using (
  auth.uid() is not null and (
    public.get_user_role() in ('admin', 'instructor')
    or (
      status = 'published' and exists (
        select 1 from public.sections s
        join public.courses c on c.id = s.course_id
        join public.enrollments e on e.course_id = c.id
        where s.id = section_id and e.user_id = auth.uid() and e.status = 'active'
      )
    )
  )
);
create policy "Admin can manage assignments" on public.assignments for insert
  with check (public.get_user_role() in ('admin', 'instructor'));
create policy "Admin can update assignments" on public.assignments for update
  using (public.get_user_role() in ('admin', 'instructor'));
create policy "Admin can delete assignments" on public.assignments for delete
  using (public.get_user_role() in ('admin', 'instructor'));

-- ============================================
-- assignment_submissions
-- ============================================
create policy "Students can read own submissions" on public.assignment_submissions for select
  using (auth.uid() = user_id);
create policy "Students can insert own submissions" on public.assignment_submissions for insert
  with check (auth.uid() = user_id);
create policy "Students can update own submissions" on public.assignment_submissions for update
  using (auth.uid() = user_id);
create policy "Admin can read all submissions" on public.assignment_submissions for select
  using (public.get_user_role() in ('admin', 'instructor'));
create policy "Admin can update all submissions" on public.assignment_submissions for update
  using (public.get_user_role() in ('admin', 'instructor'));

-- ============================================
-- certificates
-- ============================================
create policy "Students can read own certificates" on public.certificates for select
  using (auth.uid() = user_id);
create policy "Admin can read all certificates" on public.certificates for select
  using (public.get_user_role() in ('admin', 'instructor'));
create policy "Admin can insert certificates" on public.certificates for insert
  with check (public.get_user_role() in ('admin', 'instructor'));
create policy "System can insert certificates" on public.certificates for insert
  with check (auth.uid() = user_id);

-- ============================================
-- Storage policies for assignment-files bucket
-- ============================================
create policy "Users can upload own files" on storage.objects for insert
  with check (bucket_id = 'assignment-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can read own files" on storage.objects for select
  using (bucket_id = 'assignment-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Admin can read all files" on storage.objects for select
  using (bucket_id = 'assignment-files' and public.get_user_role() in ('admin', 'instructor'));
