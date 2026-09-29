-- zip内の各ファイルの中身プレビュー用: [{name, size, text|null, truncated}]
alter table public.lesson_attachments add column if not exists zip_files jsonb;
