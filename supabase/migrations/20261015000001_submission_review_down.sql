-- 20261015000001_submission_review.sql の取り消し（可逆性の担保）
-- 適用: supabase db query --linked -f supabase/migrations/20261015000001_submission_review_down.sql
drop table if exists public.review_feedback cascade;
drop table if exists public.review_submissions cascade;
drop table if exists public.review_tasks cascade;
drop table if exists public.reviewer_profiles cascade;
drop table if exists public.review_settings cascade;
drop function if exists public.review_touch_updated_at() cascade;
