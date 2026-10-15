-- 提出×添削 機能の初期データ（Claude Code初心者研修 / FDEスクール入門編）。冪等。
-- 適用: supabase db query --linked -f content/seed_review_demo.sql

-- コース設定（既定値）
insert into public.review_settings (course_id) values
  ('fa07ac27-35e7-4e09-8d3e-4564ac9e1c1e'),
  ('f4765d4f-f7dd-4c28-a17b-097aeba2b86b')
on conflict (course_id) do nothing;

-- 添削者プロフィール（管理者＝ニックネーム表示）
insert into public.reviewer_profiles (user_id, display_name, course_ids, is_active)
values ('bab3dae7-813b-43ee-b7f9-200ca779dcfd', 'きたづめ先生',
        array['fa07ac27-35e7-4e09-8d3e-4564ac9e1c1e'::uuid,'f4765d4f-f7dd-4c28-a17b-097aeba2b86b'::uuid], true)
on conflict (user_id) do update
  set display_name = excluded.display_name, course_ids = excluded.course_ids, is_active = true;

-- サンプル課題（コースに1つも無いときだけ作る）
insert into public.review_tasks (course_id, title, instructions, submission_types, estimated_minutes, order_index)
select 'fa07ac27-35e7-4e09-8d3e-4564ac9e1c1e',
  '今日のClaude Code練習：小さく1つ作る',
  E'今日学んだことで、小さなものを1つ作って提出しましょう。\n\n- 使ったプロンプト／作ったもののURL／気づき、のいずれかでOK\n- 完璧でなくて大丈夫。今日の分を出すことが一番大事です',
  array['text','url'], 15, 0
where not exists (select 1 from public.review_tasks where course_id='fa07ac27-35e7-4e09-8d3e-4564ac9e1c1e');

insert into public.review_tasks (course_id, title, instructions, submission_types, estimated_minutes, order_index)
select 'f4765d4f-f7dd-4c28-a17b-097aeba2b86b',
  '今日のFDE練習：顧客の課題を1つ言語化する',
  E'今日の学びをもとに、顧客の課題や仮説を1つ、自分の言葉で書いて提出しましょう。\n\n- 設計メモ／仮説／振り返り、作ったもののURLでもOK\n- 短くて大丈夫。まず出すことが大事です',
  array['text','url'], 20, 0
where not exists (select 1 from public.review_tasks where course_id='f4765d4f-f7dd-4c28-a17b-097aeba2b86b');

-- 動作確認用に3名を両コースへ受講登録
insert into public.enrollments (user_id, course_id, status)
select u, c, 'active' from
  (values ('bab3dae7-813b-43ee-b7f9-200ca779dcfd'::uuid),
          ('8936dff0-704d-4d2f-bff0-c84869eec0fc'::uuid),
          ('fd11370b-58d9-4d8c-b95b-bdd851515f34'::uuid)) a(u),
  (values ('fa07ac27-35e7-4e09-8d3e-4564ac9e1c1e'::uuid),
          ('f4765d4f-f7dd-4c28-a17b-097aeba2b86b'::uuid)) b(c)
on conflict (user_id, course_id) do nothing;
