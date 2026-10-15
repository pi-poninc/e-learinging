-- FDEスクール入門編 のサンプル・スキルマップ／ルーブリック／グレード（冪等）。
-- 正式定義は運営が後で差し替え。適用: supabase db query --linked -f content/seed_skillmap_fde.sql
do $$
declare
  v_course uuid := 'f4765d4f-f7dd-4c28-a17b-097aeba2b86b';
  v_map uuid;
  s_lang uuid; s_hyp uuid; s_data uuid; s_impl uuid; s_ai uuid; s_tell uuid;
  v_rubric uuid;
begin
  if exists (select 1 from public.skill_maps where course_id = v_course) then
    raise notice 'already seeded'; return;
  end if;

  insert into public.skill_maps(course_id, name, version, is_active)
    values (v_course, 'FDEスキルマップ', 1, true) returning id into v_map;

  insert into public.skills(skill_map_id, category, name, description, order_index)
    values (v_map, 'コンサル', '顧客課題の言語化', '顧客の課題を引き出し、本質を特定する', 0) returning id into s_lang;
  insert into public.skills(skill_map_id, category, name, description, order_index)
    values (v_map, 'コンサル', '仮説と優先順位づけ', '課題に優先順位をつけ、やらないことを決める', 1) returning id into s_hyp;
  insert into public.skills(skill_map_id, category, name, description, order_index)
    values (v_map, 'データ', 'データ理解・分析', 'データから示唆を出す', 2) returning id into s_data;
  insert into public.skills(skill_map_id, category, name, description, order_index)
    values (v_map, 'エンジニアリング', '実装・プロトタイピング', '動くものを素早く作る', 3) returning id into s_impl;
  insert into public.skills(skill_map_id, category, name, description, order_index)
    values (v_map, 'エンジニアリング', 'AI活用', 'AIを業務に組み込む', 4) returning id into s_ai;
  insert into public.skills(skill_map_id, category, name, description, order_index)
    values (v_map, '伝える力', '説明・提案', '相手が動く説明をする', 5) returning id into s_tell;

  insert into public.skill_levels(skill_id, level, behavior_description) values
    (s_lang,1,'ヒアリング内容を要約できる'),(s_lang,2,'課題を自分の言葉で整理できる'),(s_lang,3,'課題を構造化して説明できる'),(s_lang,4,'本質課題の仮説を立てられる'),(s_lang,5,'顧客自身が気づいていない本質課題を特定し合意を取れる'),
    (s_hyp,1,'課題を列挙できる'),(s_hyp,2,'課題を分類できる'),(s_hyp,3,'影響度で並べられる'),(s_hyp,4,'優先順位の根拠を説明できる'),(s_hyp,5,'事業インパクトで優先順位をつけ、やらないことを決められる'),
    (s_data,1,'表データを集計できる'),(s_data,2,'基本的な可視化ができる'),(s_data,3,'分析の方針を立てられる'),(s_data,4,'示唆を言語化できる'),(s_data,5,'分析設計から示唆提示まで一人でできる'),
    (s_impl,1,'手順を見ながら動くものを作れる'),(s_impl,2,'小さな機能を作れる'),(s_impl,3,'一通り動くものを作れる'),(s_impl,4,'デモ可能なものを作れる'),(s_impl,5,'半日でMVPを作り本番運用の設計まで描ける'),
    (s_ai,1,'AIに指示して小さな機能を作れる'),(s_ai,2,'AIで作業を効率化できる'),(s_ai,3,'AIの出力を評価・修正できる'),(s_ai,4,'AIを業務フローに組み込める'),(s_ai,5,'AIを組み込んだ業務フローを設計・実装できる'),
    (s_tell,1,'作ったものを説明できる'),(s_tell,2,'相手に合わせて説明できる'),(s_tell,3,'結論から簡潔に話せる'),(s_tell,4,'提案として整理できる'),(s_tell,5,'経営層に意思決定を促す提案ができる');

  insert into public.rubrics(course_id, name, is_active)
    values (v_course, 'FDE 基礎ルーブリック', true) returning id into v_rubric;
  insert into public.rubric_items(rubric_id, label, skill_id, weight, max_level, order_index) values
    (v_rubric, '顧客課題の言語化', s_lang, 1.0, 5, 0),
    (v_rubric, 'AI活用',           s_ai,   1.0, 5, 1),
    (v_rubric, '説明・提案',       s_tell, 1.0, 5, 2);

  -- FDEの既存の提出課題にルーブリックを紐づける
  update public.review_tasks set rubric_id = v_rubric where course_id = v_course and rubric_id is null;

  -- グレード（付録A）。requirements は { skill_id: 必要レベル }。
  insert into public.grades(course_id, level, name, requirements, order_index) values
    (v_course, 1, '見習い',   jsonb_build_object(s_lang::text, 1), 0),
    (v_course, 2, 'ジュニア', jsonb_build_object(s_lang::text, 2, s_impl::text, 1), 1),
    (v_course, 3, 'ミドル',   jsonb_build_object(s_lang::text, 3, s_tell::text, 3), 2),
    (v_course, 4, 'シニア',   jsonb_build_object(s_lang::text, 4, s_impl::text, 4, s_ai::text, 3), 3),
    (v_course, 5, 'リード',   jsonb_build_object(s_lang::text, 4, s_impl::text, 5, s_tell::text, 4, s_ai::text, 4), 4),
    (v_course, 6, '認定FDE', jsonb_build_object(s_lang::text, 4, s_hyp::text, 4, s_data::text, 4, s_impl::text, 4, s_ai::text, 4, s_tell::text, 4), 5);
end $$;
