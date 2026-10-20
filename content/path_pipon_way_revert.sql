-- path_pipon_way.sql のリバート。
do $$
declare t text;
begin
  for t in select unnest(array['pipon流の働き方 ― 王道ジャーニー【まずここから】','実務・設計の引き出し（リファレンス）','製造業 × AI 入門']) loop
    delete from public.path_items where path_id in (select id from public.learning_paths where title = t);
    delete from public.learning_paths where title = t;
  end loop;
end $$;
