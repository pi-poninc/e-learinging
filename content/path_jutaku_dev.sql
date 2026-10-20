-- 受託開発プロジェクトの回し方 ロードマップを作成し、炎上しない講座を組み込む。
-- 可逆: content/path_jutaku_dev_revert.sql。
do $$
declare
  v_path uuid;
begin
  select id into v_path from public.learning_paths where title = '受託開発プロジェクトの回し方';
  if v_path is null then
    insert into public.learning_paths (title, description, status, sort_order)
    values ('受託開発プロジェクトの回し方',
            '受託の開発案件を、入口の要求整理から、日々のPM運用、炎上させない定例の回し方まで、順番に学ぶロードマップ。',
            'published', 0)
    returning id into v_path;

    insert into public.path_items (path_id, course_id, sort_order, target_days, milestone_label) values
      (v_path, 'e023d316-c45f-4f7e-8b1b-0c16aebf7b21', 0, 7,  '入口：要求を設計に落とす'),
      (v_path, '1fcb3a31-b3f0-45c8-b194-be390ebd4e46', 1, 21, '運用：受託PMの作法'),
      (v_path, '92188e5e-825a-46be-a540-bdbd50eb9f63', 2, 35, '実践：炎上しない定例の回し方');
  end if;
  raise notice 'path = %', v_path;
end $$;
