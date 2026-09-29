-- ============================================
-- 学びメモ（レッスンごと・受講者本人のみ閲覧/編集）
-- ============================================
create table if not exists public.lesson_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  body text not null default '',
  updated_at timestamptz not null default now(),
  unique(user_id, lesson_id)
);

alter table public.lesson_notes enable row level security;

drop policy if exists "notes_own" on public.lesson_notes;
create policy "notes_own" on public.lesson_notes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
