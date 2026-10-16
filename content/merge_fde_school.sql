-- FDEスクール 入門編＋応用編 を 1コースに統合（全13話）。
-- 可逆: content/merge_fde_school_revert.sql。アプリ側コードにcourse ID直書きなし（seed SQLのみ）。
-- 入門編 course = f4765d4f..., 応用編 course = 376e75e1...
do $$
declare
  v_course    uuid := 'f4765d4f-f7dd-4c28-a17b-097aeba2b86b';  -- 入門編→統合先
  v_adv_course uuid := '376e75e1-bf16-4c83-805c-8a9b62b88a20'; -- 応用編（移設元・最後にアーカイブ）
  v_sec_intro uuid := 'c8d77613-1436-43bc-ad3c-0835da404c03';  -- 入門編 本編セクション
  v_sec_adv   uuid;
begin
  -- 1. 統合コースの体裁を整える
  update public.courses set
    title = 'FDEスクール（入門編＋応用編・全13話）',
    description =
      E'現場起点で価値を出すFDE（Forward Deployed Engineer）の「商売の型」を、入門編7話＋応用編6話の全13話で学びます。\n\n'
      || E'■ 入門編（第0〜6話）：FDEとは何か／入口の仕事／課題一覧／月額提案／社長への月次報告／共通の道具／ケース実演\n'
      || E'■ 応用編（第1〜6話）：提案書を書く／月額を育てる／1社を深く耕す／チームで回す／道具を製品に育てる／つまずき対処\n\n'
      || E'入門編で型を知り、応用編で単発を月額に、1社を深く掘り下げる実践へ進みます。',
    status = 'published'
  where id = v_course;

  -- 2. 既存セクションを「入門編」に改名
  update public.sections
    set title = '入門編 ― FDEの型を知る（第0〜6話）', sort_order = 0
  where id = v_sec_intro;

  -- 3. 「応用編」セクションを統合コースに作成
  insert into public.sections (course_id, title, sort_order)
  values (v_course, '応用編 ― 単発を月額に、1社を深く（第1〜6話）', 1)
  returning id into v_sec_adv;

  -- 4. 応用編コースのレッスンを新セクションへ移設（並び順は維持）
  update public.lessons l
    set section_id = v_sec_adv
  from public.sections s
  where l.section_id = s.id and s.course_id = v_adv_course;

  -- 5. 応用編コースをアーカイブ（カタログから隠す。レッスンは移設済み）
  update public.courses set status = 'archived' where id = v_adv_course;

  -- 6. 学習ロードマップ「FDE養成コース」：応用編の独立項目を外し、入門編項目を統合版に更新
  delete from public.path_items
   where path_id = '8c2b4169-43c0-42b0-a3b9-ede5c274533e' and course_id = v_adv_course;
  update public.path_items
    set milestone_label = 'FDEの型（入門＋応用・全13話）', target_days = 42
  where path_id = '8c2b4169-43c0-42b0-a3b9-ede5c274533e' and course_id = v_course;

  raise notice 'merged: new 応用編 section = %', v_sec_adv;
end $$;
