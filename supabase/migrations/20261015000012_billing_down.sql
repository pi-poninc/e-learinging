-- 20261015000012_billing.sql の取り消し
drop policy if exists course_purchases_own_read on public.course_purchases;
drop policy if exists course_purchases_staff_read on public.course_purchases;
drop table if exists public.course_purchases;
alter table public.courses drop column if exists price_jpy;
