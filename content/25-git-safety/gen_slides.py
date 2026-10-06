#!/usr/bin/env python3
"""はじめてのGitとコマンド 第6回 困ったとき＆安全・最小ワークフロー。素人向け。
台本の行数=スライド枚数(7)に一致させること。"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _deck import build_deck  # noqa: E402

SLIDES = [
    {"type": "title", "kicker": "はじめてのGitとコマンド ｜ 第6回（最終回）",
     "title": "困ったとき＆安全のコツ",
     "sub": "― 今日から使える最小ワークフロー",
     "foot": "株式会社pipon｜pipon learning（まったくの初心者向け）"},

    {"kicker": "困ったら、まず", "title": "git status ―「今どこ・今どうなってる」を確認",
     "bullets": [
         "操作に迷ったら、とにかく $ git status。変更やadd の状況が分かる",
         "$ git log で、これまでの保存履歴も確認できる",
         "あわてて操作する前に、“現在地”を見るクセをつける",
     ]},

    {"kicker": "気をつけること", "title": "やってはいけない・注意すること",
     "bullets": [
         "$ rm -rf のような“まとめて消す”命令は、確認せずに使わない（戻せない）",
         "パスワードやAPIキーなどの秘密情報は、commit しない（公開事故のもと）",
         "意味の分からないコマンドを、コピペでそのまま実行しない",
     ],
     "note": "少しでも不安な操作は、実行する前に詳しい人に聞く。これが一番安全"},

    {"kicker": "間違えたとき", "title": "たいていは“戻せる”から大丈夫",
     "bullets": [
         "まだ commit していない変更 → 元に戻すコマンドで戻せる（status が教えてくれる）",
         "commit 済みでも、履歴が残っているので過去の時点に戻れる",
         "こわい操作・分からないエラーは、無理せず人に相談。Gitは基本やり直せる",
     ]},

    {"kicker": "今日から使う", "title": "最小ワークフロー（これだけで回る）",
     "bullets": [
         "① git clone（or init）でプロジェクトを用意",
         "② ファイルを編集 → ③ git add . → ④ git commit -m \"説明\"",
         "⑤ git push でクラウドへ。次の作業前に git pull で最新に",
     ]},

    {"kicker": "よく使うコマンド早見", "title": "まずはこの10個",
     "rows": [
         ("pwd / ls / cd", "今どこ・何がある・移動"),
         ("git status / git log", "今の状態・履歴を見る（迷ったらこれ）"),
         ("git add / git commit", "変更を選ぶ・保存する"),
         ("git push / git pull / git clone", "送る・受け取る・コピーしてくる"),
     ]},

    {"kicker": "全6回まとめ", "title": "黒い画面は、もう怖くない",
     "bullets": [
         "コマンド＝文字で命令。pwd・ls・cd で迷子にならない",
         "Git＝履歴が残り戻せる仕組み。編集→add→commit のくり返し",
         "GitHubで push / pull して共有。困ったら status、不安なら人に聞く。おつかれさまでした",
     ]},
]

if __name__ == "__main__":
    build_deck(SLIDES, Path(__file__).resolve().parent / "slides.pptx")
