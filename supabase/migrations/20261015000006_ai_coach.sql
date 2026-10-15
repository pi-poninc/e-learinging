-- 育成プログラム（第2弾）Phase D: AIコーチ（提出と提出の間の相談相手）
-- 追加のみ・破壊的変更なし。down は _down.sql
-- 適用: supabase db query --linked -f supabase/migrations/20261015000006_ai_coach.sql

alter table public.review_settings add column if not exists ai_coach_enabled boolean not null default false;
alter table public.review_settings add column if not exists ai_coach_daily_limit int not null default 20;

create table if not exists public.coach_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  task_id uuid references public.review_tasks(id) on delete set null,
  flagged boolean not null default false,       -- 丸投げ等の兆候（自動ブロックはしない）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists coach_conversations_user_idx on public.coach_conversations(user_id, updated_at desc);

create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.coach_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  tokens_in int,
  tokens_out int,
  created_at timestamptz not null default now()
);
create index if not exists coach_messages_conv_idx on public.coach_messages(conversation_id, created_at);
create index if not exists coach_messages_user_day_idx on public.coach_messages(role, created_at);

drop trigger if exists coach_conversations_touch on public.coach_conversations;
create trigger coach_conversations_touch before update on public.coach_conversations
  for each row execute function public.review_touch_updated_at();

-- RLS: 本人は自分の会話を読み書き／スタッフ（講師）は閲覧できる
alter table public.coach_conversations enable row level security;
alter table public.coach_messages enable row level security;

drop policy if exists coach_conversations_own on public.coach_conversations;
create policy coach_conversations_own on public.coach_conversations for select to authenticated
  using (auth.uid() = user_id or public.get_user_role() in ('admin','instructor','manager'));
drop policy if exists coach_conversations_own_write on public.coach_conversations;
create policy coach_conversations_own_write on public.coach_conversations for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists coach_conversations_own_update on public.coach_conversations;
create policy coach_conversations_own_update on public.coach_conversations for update to authenticated
  using (auth.uid() = user_id or public.get_user_role() in ('admin','instructor','manager'))
  with check (auth.uid() = user_id or public.get_user_role() in ('admin','instructor','manager'));

drop policy if exists coach_messages_read on public.coach_messages;
create policy coach_messages_read on public.coach_messages for select to authenticated
  using (
    exists (select 1 from public.coach_conversations c where c.id = coach_messages.conversation_id
            and (c.user_id = auth.uid() or public.get_user_role() in ('admin','instructor','manager')))
  );
drop policy if exists coach_messages_insert on public.coach_messages;
create policy coach_messages_insert on public.coach_messages for insert to authenticated
  with check (
    exists (select 1 from public.coach_conversations c where c.id = coach_messages.conversation_id and c.user_id = auth.uid())
  );
