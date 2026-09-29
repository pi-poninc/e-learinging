-- ============================================
-- 部署マネージャー ロールを追加
-- manager は profiles.group_id で担当部署を表す（自部署の進捗のみ閲覧）
-- ============================================
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'instructor', 'manager', 'student'));
