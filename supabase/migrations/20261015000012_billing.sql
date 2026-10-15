-- 決済（Stripe 買い切り）Phase: 講座ごとの有料化。追加のみ。down は _down.sql
-- 既存講座は price_jpy = null（= 無料）のまま。既存の受講フローに影響しない。

-- 講座に価格（円・税込想定）。null または 0 は無料。
alter table public.courses add column if not exists price_jpy integer;

-- 購入履歴。Stripe Checkout 完了時に webhook が1行作る。
create table if not exists public.course_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  amount_jpy integer not null,
  status text not null default 'paid',               -- paid / refunded
  stripe_session_id text unique,                     -- 冪等化のキー（同一セッションの二重処理を防ぐ）
  stripe_payment_intent text,
  created_at timestamptz not null default now()
);

create index if not exists course_purchases_user_idx on public.course_purchases(user_id);
create index if not exists course_purchases_course_idx on public.course_purchases(course_id);

alter table public.course_purchases enable row level security;

-- 本人は自分の購入履歴を読める。
create policy course_purchases_own_read on public.course_purchases for select to authenticated
  using (user_id = auth.uid());

-- スタッフは全件読める。
create policy course_purchases_staff_read on public.course_purchases for select to authenticated
  using (public.get_user_role() in ('admin','instructor','manager'));

-- 書き込みは service_role（webhook）のみ。authenticated には insert/update/delete ポリシーを作らない
-- （RLS 有効 ＝ ポリシー無しの操作は拒否。service_role は RLS をバイパス）。
