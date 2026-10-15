-- 育成プログラム（第2弾）Phase C-2: ピアレビューの割り当て（プライバシー安全な読取）
-- 追加のみ・破壊的変更なし（status check 拡張）。down は _down.sql
-- 適用: supabase db query --linked -f supabase/migrations/20261015000005_peer_assign.sql

-- peer_reviews に 'assigned'（割当済・未記入）状態を追加
alter table public.peer_reviews drop constraint if exists peer_reviews_status_check;
alter table public.peer_reviews add constraint peer_reviews_status_check
  check (status in ('assigned','submitted'));

-- 割り当てられたピアレビュアーだけが、その対象提出を読める（他人の提出の一般公開はしない）
drop policy if exists review_submissions_peer_read on public.review_submissions;
create policy review_submissions_peer_read on public.review_submissions for select to authenticated
  using (
    exists (
      select 1 from public.peer_reviews pr
      where pr.submission_id = review_submissions.id and pr.reviewer_id = auth.uid()
    )
  );
