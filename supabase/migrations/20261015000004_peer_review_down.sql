-- 20261015000004_peer_review.sql の取り消し
drop table if exists public.peer_reviews cascade;
alter table public.review_feedback drop constraint if exists review_feedback_status_check;
alter table public.review_feedback add constraint review_feedback_status_check
  check (status in ('claimed','drafting','published'));
alter table public.review_feedback drop column if exists veteran_checked_by;
alter table public.review_feedback drop column if exists veteran_checked_at;
alter table public.reviewer_profiles drop column if exists needs_approval_remaining;
alter table public.review_settings drop column if exists peer_review_min_grade;
alter table public.review_settings drop column if exists new_reviewer_check_count;
