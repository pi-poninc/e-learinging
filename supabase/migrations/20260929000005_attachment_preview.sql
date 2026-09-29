-- 配布ファイルの中身プレビュー用カラム
-- preview_text: テキスト系(.md/.txt/.csv/.json)の本文（先頭を保存）
-- zip_entries : zip内のファイル名一覧
alter table public.lesson_attachments add column if not exists preview_text text;
alter table public.lesson_attachments add column if not exists zip_entries jsonb;
