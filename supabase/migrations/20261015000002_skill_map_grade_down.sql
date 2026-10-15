-- 20261015000002_skill_map_grade.sql の取り消し
-- 適用: supabase db query --linked -f supabase/migrations/20261015000002_skill_map_grade_down.sql
alter table public.review_tasks drop column if exists rubric_id;
drop table if exists public.user_grades cascade;
drop table if exists public.grades cascade;
drop table if exists public.user_skill_levels cascade;
drop table if exists public.skill_assessments cascade;
drop table if exists public.rubric_items cascade;
drop table if exists public.rubrics cascade;
drop table if exists public.skill_levels cascade;
drop table if exists public.skills cascade;
drop table if exists public.skill_maps cascade;
drop table if exists public.learning_events cascade;
