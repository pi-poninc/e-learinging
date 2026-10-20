-- 「pipon流の働き方」王道ジャーニー＋リファレンス2本を作成し、迷子講座を全て所属させる。
-- 可逆: content/path_pipon_way_revert.sql。
do $$
declare v_path uuid;
begin
  ----------------------------------------------------------------------
  -- 王道ジャーニー（まずここから）
  ----------------------------------------------------------------------
  select id into v_path from public.learning_paths where title = 'pipon流の働き方 ― 王道ジャーニー【まずここから】';
  if v_path is null then
    insert into public.learning_paths (title, description, status, sort_order)
    values ('pipon流の働き方 ― 王道ジャーニー【まずここから】',
            '何から学べばいいか迷ったらこれ。会社の基本→道具(Claude Code)→設計の型→案件の回し方→商売の型→判断→知的生産まで、pipon流の働き方が身につく順番に並べた王道コースです。',
            'published', -100)
    returning id into v_path;
    insert into public.path_items (path_id, course_id, sort_order, target_days, milestone_label) values
      (v_path, 'd849b67c-63eb-44d2-9a58-e0e177c3bf24', 0,  7,   '基礎：会社と仕事の基本'),
      (v_path, 'e7643443-d570-4066-81bf-328818e47345', 1,  14,  '道具：Claude Codeを自走で使う'),
      (v_path, 'd9853675-6079-41a2-b39a-ccde9392fb53', 2,  28,  '設計の型①：困りごとから機能へ'),
      (v_path, 'e023d316-c45f-4f7e-8b1b-0c16aebf7b21', 3,  35,  '設計の型②：分類と全体絵'),
      (v_path, '1e8a62f8-3716-409f-b452-d91400cc3150', 4,  42,  '実務例：紙・FAXの自動化（横展開の鉄板）'),
      (v_path, '1fcb3a31-b3f0-45c8-b194-be390ebd4e46', 5,  56,  '案件を回す①：受託PMの作法'),
      (v_path, '92188e5e-825a-46be-a540-bdbd50eb9f63', 6,  63,  '案件を回す②：炎上しない定例'),
      (v_path, 'f4765d4f-f7dd-4c28-a17b-097aeba2b86b', 7,  84,  '商売の型：FDEスクール（入門＋応用）'),
      (v_path, 'ee840bda-526d-4870-a593-899236c07e04', 8,  91,  '顧客と決める：ワークショップの回し方'),
      (v_path, 'a6b253ec-f6e8-413d-816b-4a49a881640a', 9,  98,  '判断を追体験：動物病院の電子カルテ'),
      (v_path, 'd4d827d2-9093-4124-b54f-228b105aeaf4', 10, 112, '知的生産で自走：第二の脳');
  end if;

  ----------------------------------------------------------------------
  -- 実務・設計の引き出し（リファレンス）
  ----------------------------------------------------------------------
  select id into v_path from public.learning_paths where title = '実務・設計の引き出し（リファレンス）';
  if v_path is null then
    insert into public.learning_paths (title, description, status, sort_order)
    values ('実務・設計の引き出し（リファレンス）',
            '必要になったときに引く、実務と設計のリファレンス集。道具の基礎・データ基盤・認証・AI品質・社内オペ・事例を集めています。順番は任意。',
            'published', 50)
    returning id into v_path;
    insert into public.path_items (path_id, course_id, sort_order, target_days, milestone_label) values
      (v_path, 'fa07ac27-35e7-4e09-8d3e-4564ac9e1c1e', 0, null, '道具の基礎：Claude Code初心者研修'),
      (v_path, '17dd2cd5-38d6-49f3-b52a-b6ee70db7698', 1, null, 'データ基盤：Everything is an event'),
      (v_path, '91d776a1-d4f8-48a2-b2e9-749193ee4040', 2, null, '認証設計シリーズ'),
      (v_path, '1c9506aa-f423-4308-84d7-c75e2ada8cd3', 3, null, 'AI品質：ハルシネーション対策'),
      (v_path, '8f20dde1-406e-4ac0-a0fe-dac73b7141c8', 4, null, '社内オペ：eラーニングの作り方'),
      (v_path, 'e08f7215-ad69-4eb1-928d-dd5484fb076d', 5, null, '事例：AI研修（顧客向け）'),
      (v_path, '653e9b39-3794-4211-8b6f-aaa2e6e09934', 6, null, '事例：LINE Harness');
  end if;

  ----------------------------------------------------------------------
  -- 製造業 × AI 入門
  ----------------------------------------------------------------------
  select id into v_path from public.learning_paths where title = '製造業 × AI 入門';
  if v_path is null then
    insert into public.learning_paths (title, description, status, sort_order)
    values ('製造業 × AI 入門',
            '製造現場の前提知識とAI活用をまとめたシリーズ。電気設備の基礎から、AI選別、成分分析（LIBS/XRF）まで。',
            'published', 60)
    returning id into v_path;
    insert into public.path_items (path_id, course_id, sort_order, target_days, milestone_label) values
      (v_path, '9943f77d-8487-4a42-a9e7-39ea71f06855', 0, 7,  '前提：工場の電気設備 入門'),
      (v_path, '52428f66-a729-4a20-9073-45394a8a4d59', 1, 14, 'AI選別：超硬チップ（TA選別）'),
      (v_path, 'fb790ee6-89bb-407b-9b1f-f9008db31d9a', 2, 21, '成分分析：LIBS/XRFと品種判別');
  end if;

  raise notice 'paths created';
end $$;
