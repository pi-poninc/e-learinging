-- path_jutaku_dev.sql のリバート。
delete from public.path_items where path_id in (select id from public.learning_paths where title = '受託開発プロジェクトの回し方');
delete from public.learning_paths where title = '受託開発プロジェクトの回し方';
