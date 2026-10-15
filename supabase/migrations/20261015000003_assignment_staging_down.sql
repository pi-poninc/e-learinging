-- 20261015000003_assignment_staging.sql の取り消し
-- 適用: supabase db query --linked -f supabase/migrations/20261015000003_assignment_staging_down.sql

-- review_tasks 閲覧ポリシーを元（Phase1）に戻す
drop policy if exists review_tasks_read on public.review_tasks;
create policy review_tasks_read on public.review_tasks for select to authenticated
  using (is_active or public.get_user_role() in ('admin','instructor','manager'));

drop trigger if exists review_tasks_anon_gate on public.review_tasks;
drop function if exists public.review_task_anon_gate() cascade;

drop table if exists public.task_assignments cascade;
drop table if exists public.review_task_starts cascade;
drop table if exists public.case_material_private cascade;
drop table if exists public.case_materials cascade;

alter table public.review_tasks drop column if exists case_material_id;
alter table public.review_tasks drop column if exists prerequisite_grade_id;
alter table public.review_tasks drop column if exists time_limit_minutes;
alter table public.review_tasks drop column if exists difficulty_level;
alter table public.review_tasks drop column if exists target_skill_ids;
alter table public.review_tasks drop column if exists assignment_type;
