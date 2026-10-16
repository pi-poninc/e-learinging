-- 案件追体験シリーズの整理: 設計編4本を1コースに統合＋全体を「案件追体験コレクション」ロードマップ化。
-- 可逆: content/merge_case_series_revert.sql。アプリ側コードにID直書きなし。
do $$
declare
  v_base    uuid := 'a410d1f9-f22a-46ee-bee3-366afa31809d';  -- 設計編:認証（統合先）
  v_base_sec uuid := 'daa6af90-5c64-43c2-93af-8355af4cc939'; -- 統合先セクション
  v_c_multi uuid := '40a837cf-3878-4d86-880e-1aafe1176675';  -- 多店舗
  v_c_ins   uuid := '4f83edee-0ce0-469e-866c-74ccfa5f74ea';  -- 保険金
  v_c_req   uuid := '7bd05290-5d4a-47c1-a6f9-1f91241405d5';  -- 要件整理
  v_case_auth  uuid := '6b739190-42b7-46d7-8dbb-bc6278ad6a89';
  v_case_multi uuid := '11b58616-b51b-4798-9d69-8f43ba6bed89';
  v_case_ins   uuid := '59b79928-b669-4ab8-8d70-3b22c34b15b7';
  v_case_req   uuid := '9894bf94-eb3b-42f8-9513-50b8f12219f3';
  v_path uuid;
begin
  -- 1. 統合先コース・セクションを整える
  update public.courses set
    title = '案件追体験（設計編・全4ケース）',
    description =
      E'実案件の「設計の勘所」を4ケースで追体験します。要件の抜け漏れ・方式選定・過剰設計の回避を、手を動かしながら身につけます。\n\n'
      || E'① 認証の要件定義（ロック条件・リセット・通知などの決め事）\n'
      || E'② 多店舗プラットフォーム設計\n'
      || E'③ 保険金査定の自動化\n'
      || E'④ AIで要件整理・論点出し',
    status = 'published'
  where id = v_base;
  update public.sections set title = '設計の型 ― 要件定義・方式選定（全4ケース）', sort_order = 0 where id = v_base_sec;

  -- 2. 他3ケースを統合先セクションへ移設し、並び順を設定
  update public.case_simulations set section_id = v_base_sec, sort_order = 0 where id = v_case_auth;
  update public.case_simulations set section_id = v_base_sec, sort_order = 1 where id = v_case_multi;
  update public.case_simulations set section_id = v_base_sec, sort_order = 2 where id = v_case_ins;
  update public.case_simulations set section_id = v_base_sec, sort_order = 3 where id = v_case_req;

  -- 3. 空になった設計編3コースをアーカイブ
  update public.courses set status = 'archived' where id in (v_c_multi, v_c_ins, v_c_req);

  -- 4. ロードマップ「案件追体験コレクション」を作成（既存なら作らない）
  select id into v_path from public.learning_paths where title = '案件追体験コレクション ― 現場の判断を追体験する';
  if v_path is null then
    insert into public.learning_paths (title, description, status, sort_order)
    values ('案件追体験コレクション ― 現場の判断を追体験する',
            '実案件を題材に、要件定義から設計・PM・応用（電話×AI）までの判断を順番に追体験するロードマップ。',
            'published', 0)
    returning id into v_path;

    insert into public.path_items (path_id, course_id, sort_order, target_days, milestone_label) values
      (v_path, '096e617a-ee19-459e-a030-b3450470f0e5', 0, 7,  'まず流れを動画で（動物病院）'),
      (v_path, 'a6b253ec-f6e8-413d-816b-4a49a881640a', 1, 14, '本体ケースで判断を体験（動物病院）'),
      (v_path, v_base,                                 2, 28, '設計の型（要件定義・方式選定・全4ケース）'),
      (v_path, '6387440a-2417-4f06-b7e1-aa5fd68aa46b', 3, 35, '複数社連携のPM'),
      (v_path, '02c33fbf-d359-40e9-986f-ae81835f9587', 4, 42, '応用：電話×AI');
  end if;

  raise notice 'case series merged. path = %', v_path;
end $$;
