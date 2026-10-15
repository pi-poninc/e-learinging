-- 20261015000006_ai_coach.sql の取り消し
drop table if exists public.coach_messages cascade;
drop table if exists public.coach_conversations cascade;
alter table public.review_settings drop column if exists ai_coach_enabled;
alter table public.review_settings drop column if exists ai_coach_daily_limit;
