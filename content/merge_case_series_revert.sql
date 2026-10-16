-- merge_case_series.sql のリバート。
do $$
declare
  v_base    uuid := 'a410d1f9-f22a-46ee-bee3-366afa31809d';
  v_base_sec uuid := 'daa6af90-5c64-43c2-93af-8355af4cc939';
  v_c_multi uuid := '40a837cf-3878-4d86-880e-1aafe1176675';
  v_c_ins   uuid := '4f83edee-0ce0-469e-866c-74ccfa5f74ea';
  v_c_req   uuid := '7bd05290-5d4a-47c1-a6f9-1f91241405d5';
  s_multi uuid := '2b892456-c524-4016-8953-ba72234db4ee';
  s_ins   uuid := '0a4edf20-601e-4c87-b159-c6345e006337';
  s_req   uuid := '45116713-5298-4a3c-b0eb-027d8ea9a1ce';
  v_case_multi uuid := '11b58616-b51b-4798-9d69-8f43ba6bed89';
  v_case_ins   uuid := '59b79928-b669-4ab8-8d70-3b22c34b15b7';
  v_case_req   uuid := '9894bf94-eb3b-42f8-9513-50b8f12219f3';
begin
  -- ケースを元のセクションへ戻す
  update public.case_simulations set section_id = s_multi, sort_order = 0 where id = v_case_multi;
  update public.case_simulations set section_id = s_ins,   sort_order = 0 where id = v_case_ins;
  update public.case_simulations set section_id = s_req,   sort_order = 0 where id = v_case_req;

  -- アーカイブ解除
  update public.courses set status = 'published' where id in (v_c_multi, v_c_ins, v_c_req);

  -- 統合先の名称復元
  update public.courses set title = '案件追体験（設計編）：認証の要件定義' where id = v_base;
  update public.sections set title = '本編', sort_order = 0 where id = v_base_sec;

  -- ロードマップ削除
  delete from public.path_items where path_id in (select id from public.learning_paths where title = '案件追体験コレクション ― 現場の判断を追体験する');
  delete from public.learning_paths where title = '案件追体験コレクション ― 現場の判断を追体験する';
end $$;
