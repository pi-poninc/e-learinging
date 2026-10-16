-- merge_fde_school.sql のリバート。
-- 応用編レッスンを元コースの本編セクションに戻し、統合コースの体裁・ロードマップを復元する。
do $$
declare
  v_course     uuid := 'f4765d4f-f7dd-4c28-a17b-097aeba2b86b';
  v_adv_course uuid := '376e75e1-bf16-4c83-805c-8a9b62b88a20';
  v_sec_intro  uuid := 'c8d77613-1436-43bc-ad3c-0835da404c03';
  v_sec_adv_orig uuid := '177e886e-64d4-441e-ae80-6b71323ca4fc'; -- 応用編 元セクション
  v_sec_adv_new  uuid;
begin
  -- 統合時に作った応用編セクションを特定
  select id into v_sec_adv_new from public.sections
   where course_id = v_course and title like '応用編%' order by sort_order desc limit 1;

  -- レッスンを元の応用編セクションへ戻す
  if v_sec_adv_new is not null then
    update public.lessons set section_id = v_sec_adv_orig where section_id = v_sec_adv_new;
    delete from public.sections where id = v_sec_adv_new;
  end if;

  -- 応用編コールを公開に戻す
  update public.courses set status = 'published' where id = v_adv_course;

  -- 入門編コース・セクションの名称を復元
  update public.courses set title = 'FDEスクール 入門編（全7話）', status = 'published' where id = v_course;
  update public.sections set title = '本編', sort_order = 0 where id = v_sec_intro;

  -- ロードマップを復元
  update public.path_items set milestone_label = '商売の型', target_days = 28
   where path_id = '8c2b4169-43c0-42b0-a3b9-ede5c274533e' and course_id = v_course;
  insert into public.path_items (path_id, course_id, sort_order, target_days, milestone_label)
  select '8c2b4169-43c0-42b0-a3b9-ede5c274533e', v_adv_course, 3, 42, '商売の型(応用)'
  where not exists (
    select 1 from public.path_items
     where path_id = '8c2b4169-43c0-42b0-a3b9-ede5c274533e' and course_id = v_adv_course);
end $$;
