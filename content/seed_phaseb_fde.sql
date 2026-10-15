-- Phase B デモ: FDEスクール入門編 に ケース課題／時間制限課題／ドリル難易度 を投入（冪等）
-- 適用: supabase db query --linked -f content/seed_phaseb_fde.sql
do $$
declare
  v_course uuid := 'f4765d4f-f7dd-4c28-a17b-097aeba2b86b';
  v_admin uuid := 'bab3dae7-813b-43ee-b7f9-200ca779dcfd';
  s_lang uuid; s_impl uuid;
  v_rubric uuid; v_case uuid;
begin
  select s.id into s_lang from public.skills s
    join public.skill_maps m on m.id = s.skill_map_id
    where m.course_id = v_course and s.name = '顧客課題の言語化' limit 1;
  select s.id into s_impl from public.skills s
    join public.skill_maps m on m.id = s.skill_map_id
    where m.course_id = v_course and s.name = '実装・プロトタイピング' limit 1;
  select id into v_rubric from public.rubrics where course_id = v_course limit 1;

  -- 既存ドリル課題に難易度・対象スキルを付与（推薦が効くように）
  update public.review_tasks
    set difficulty_level = coalesce(difficulty_level, 1),
        target_skill_ids = case when target_skill_ids = '{}' then array[s_lang] else target_skill_ids end
    where course_id = v_course and assignment_type = 'drill';

  -- ケース課題（匿名化承認済みのケース教材を使う）
  if not exists (select 1 from public.case_materials where course_id = v_course and title = 'ある製造業の受発注の滞留') then
    insert into public.case_materials (course_id, title, background, materials, anonymization_status, anonymization_reviewed_by)
    values (v_course, 'ある製造業の受発注の滞留',
      E'ある製造業の企業で、受発注の処理が滞留し、納期遅延が増えている。現場は「担当者ごとにやり方が違う」と言い、経営は「どこがボトルネックか分からない」と言う。（※顧客名・個人名・具体数値は匿名化済み）',
      '[{"type":"transcript","name":"ヒアリング議事メモ（匿名化済み）"}]'::jsonb,
      'approved', v_admin)
    returning id into v_case;

    insert into public.case_material_private (case_material_id, model_answer, source_project_note)
    values (v_case, E'模範解答のポイント：\n- 「やり方が違う」を具体の工程差に分解できているか\n- ボトルネックを一次情報（滞留件数・待ち時間）で特定できているか\n- 最初の一手を1つに絞れているか', '元案件メモはスタッフのみ');

    insert into public.review_tasks (course_id, title, instructions, submission_types, assignment_type, difficulty_level, target_skill_ids, case_material_id, rubric_id, estimated_minutes, order_index, is_active)
    values (v_course, 'ケース：受発注の滞留を整理して提案する',
      E'ケース教材を読み、①本質課題の仮説 ②根拠 ③最初の一手 を1枚にまとめて提出してください。',
      array['text','url'], 'case', 3, array[s_lang], v_case, v_rubric, 40, 10, true);
  end if;

  -- 時間制限課題（6時間）
  if not exists (select 1 from public.review_tasks where course_id = v_course and assignment_type = 'timed_challenge') then
    insert into public.review_tasks (course_id, title, instructions, submission_types, assignment_type, difficulty_level, target_skill_ids, time_limit_minutes, rubric_id, estimated_minutes, order_index, is_active)
    values (v_course, '実戦：6時間でMVPを作ってデモする',
      E'開始後に要望が公開されます。制限時間内に、要望を満たすMVPを作り、デモ動画またはURLを提出してください（朝ヒアリング→午後デプロイの再現）。',
      array['text','url'], 'timed_challenge', 4, array[s_impl], 360, v_rubric, 360, 20, true);
  end if;
end $$;
