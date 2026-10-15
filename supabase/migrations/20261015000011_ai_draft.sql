-- 育成プログラム（第2弾）Phase G-2: AI下書き補助＋データ好循環
-- 追加のみ。down は _down.sql
alter table public.review_feedback add column if not exists ai_rewrite_rate numeric;  -- AI下書きからの書き換え率(0-1)
alter table public.review_feedback add column if not exists is_exemplar boolean not null default false; -- 良い添削の例
