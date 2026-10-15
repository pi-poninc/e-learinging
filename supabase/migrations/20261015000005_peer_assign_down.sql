-- 20261015000005_peer_assign.sql の取り消し
drop policy if exists review_submissions_peer_read on public.review_submissions;
alter table public.peer_reviews drop constraint if exists peer_reviews_status_check;
alter table public.peer_reviews add constraint peer_reviews_status_check
  check (status in ('submitted'));
