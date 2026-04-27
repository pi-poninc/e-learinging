-- ============================================
-- E-Learning MVP: Seed Data
-- ============================================
-- NOTE: ユーザーはSupabase Auth経由で作成する必要があります。
-- Supabaseダッシュボード > Authentication > Users から作成してください。
-- 作成後、profilesテーブルのroleを手動で'admin'に更新してください。
--
-- 例（Supabase SQL Editorで実行）：
-- UPDATE profiles SET role = 'admin' WHERE id = '<作成したユーザーのUUID>';

-- サンプル講座（adminユーザー作成後にcreated_byを更新してください）
INSERT INTO courses (id, title, description, status, thumbnail_url) VALUES
  ('11111111-1111-1111-1111-111111111111', 'はじめてのプログラミング', 'プログラミングの基礎を動画で学ぶ入門講座です。', 'published', null),
  ('22222222-2222-2222-2222-222222222222', 'Webデザイン入門', 'HTML/CSSの基礎から実践まで学べるコースです。', 'draft', null);

-- セクション
INSERT INTO sections (id, course_id, title, sort_order) VALUES
  ('aaaa0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '第1章: プログラミングとは', 0),
  ('aaaa0002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '第2章: 変数と型', 1),
  ('aaaa0003-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', '第1章: HTMLの基本', 0);

-- レッスン（Vimeo URLはダミー）
INSERT INTO lessons (id, section_id, title, body, vimeo_url, vimeo_video_id, duration_seconds, sort_order, status) VALUES
  ('bbbb0001-0000-0000-0000-000000000001', 'aaaa0001-0000-0000-0000-000000000001', 'プログラミングとは何か', 'プログラミングの概要を解説します。', 'https://vimeo.com/76979871', '76979871', 180, 0, 'published'),
  ('bbbb0002-0000-0000-0000-000000000002', 'aaaa0001-0000-0000-0000-000000000001', '開発環境のセットアップ', '開発環境を準備しましょう。', 'https://vimeo.com/76979871', '76979871', 300, 1, 'published'),
  ('bbbb0003-0000-0000-0000-000000000003', 'aaaa0002-0000-0000-0000-000000000002', '変数の基本', '変数の宣言と代入について学びます。', 'https://vimeo.com/76979871', '76979871', 240, 0, 'published'),
  ('bbbb0004-0000-0000-0000-000000000004', 'aaaa0003-0000-0000-0000-000000000003', 'HTMLとは', 'HTMLの基本構造を学びます。', null, null, 200, 0, 'draft');

-- NOTE: enrollmentはadminユーザー作成後に管理画面から追加するか、以下のように手動で作成してください。
-- INSERT INTO enrollments (user_id, course_id) VALUES ('<studentユーザーのUUID>', '11111111-1111-1111-1111-111111111111');
