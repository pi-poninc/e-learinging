-- ダイジェスト動画(「まず全体像を動画で」)を各講座の先頭に表示する。
-- 元は build_course.py の --start-order で末尾(order 8〜12)に追記されており、
-- 「まず全体像を」なのに最下部で見落とされていた問題を修正。sort_order=-1 で先頭化。
-- 以後、ダイジェスト動画は --start-order -1 で登録するか、本SQLを再実行する。
update public.lessons set sort_order = -1 where title like '%まず全体像を動画で%';
