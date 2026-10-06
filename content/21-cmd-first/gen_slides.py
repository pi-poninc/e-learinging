#!/usr/bin/env python3
"""はじめてのGitとコマンド 第2回 最初のコマンド（迷子にならない）。素人向け。
台本の行数=スライド枚数(7)に一致させること。"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _deck import build_deck  # noqa: E402

SLIDES = [
    {"type": "title", "kicker": "はじめてのGitとコマンド ｜ 第2回",
     "title": "最初のコマンド",
     "sub": "― この5つで迷子にならない",
     "foot": "株式会社pipon｜pipon learning（まったくの初心者向け）"},

    {"kicker": "① いまどこ？", "title": "pwd ― 現在地を表示する",
     "bullets": [
         "ターミナルの中では、今どこかの「フォルダの中」に立っている",
         "$ pwd と打つと、今いる場所（フォルダの住所）が表示される",
         "迷ったら、まず pwd。“自分がどこにいるか”を確認する",
     ]},

    {"kicker": "② 何がある？", "title": "ls ― その場所の中身を見る",
     "bullets": [
         "$ ls と打つと、今いるフォルダの中のファイル・フォルダ一覧が出る",
         "エル・エス（list の略）。中身を“見るだけ”なので安全",
         "$ ls -l で詳しく、$ ls -a で隠しファイルも表示できる",
     ]},

    {"kicker": "③ 移動する", "title": "cd ― フォルダを開く／戻る",
     "bullets": [
         "$ cd フォルダ名 で、その中に入る（change directory の略）",
         "$ cd .. で、一つ上のフォルダに戻る（ドット2つ）",
         "$ cd だけ、または $ cd ~ で、自分のホーム（最初の場所）に戻れる",
     ],
     "note": "入る→ls で中を見る→また cd、の繰り返しでフォルダを行き来する"},

    {"kicker": "④ 作る", "title": "mkdir／touch ― フォルダとファイルを作る",
     "rows": [
         ("$ mkdir 名前", "フォルダを作る（make directory の略）"),
         ("$ touch 名前.txt", "空のファイルを作る"),
         ("確認", "作ったら ls で、ちゃんとできたか見てみる"),
     ]},

    {"kicker": "入力を楽にするコツ", "title": "コマンドの形と、便利キー",
     "bullets": [
         "コマンドの形は「命令 + オプション + 対象」（例：ls -l フォルダ名）",
         "Tabキー：途中まで打って押すと、名前を自動で補完してくれる",
         "↑キー：前に打ったコマンドを呼び出せる（打ち直し不要）",
     ]},

    {"kicker": "第2回まとめ", "title": "5つ覚えれば、もう迷子にならない",
     "bullets": [
         "pwd（今どこ）／ ls（何がある）／ cd（移動）",
         "mkdir（フォルダを作る）／ touch（ファイルを作る）",
         "迷ったら pwd と ls。Tabキーと↑キーで入力はぐっと楽になる",
     ]},
]

if __name__ == "__main__":
    build_deck(SLIDES, Path(__file__).resolve().parent / "slides.pptx")
