#!/usr/bin/env python3
"""はじめてのGitとコマンド 第4回 gitの基本の流れ（add→commit）。素人向け。
台本の行数=スライド枚数(7)に一致させること。"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _deck import build_deck  # noqa: E402

SLIDES = [
    {"type": "title", "kicker": "はじめてのGitとコマンド ｜ 第4回",
     "title": "Gitの基本の流れ",
     "sub": "― 編集 → add → commit",
     "foot": "株式会社pipon｜pipon learning（まったくの初心者向け）"},

    {"kicker": "まず全体像", "title": "3つの場所を行き来するイメージ",
     "rows": [
         ("① 作業場", "ふだん編集する場所（working）。ここでファイルを書き換える"),
         ("② 準備棚", "保存したい変更を“選んで載せる”場所（staging）"),
         ("③ 保存庫", "確定した履歴がたまる場所（repository）"),
     ],
     "note": "作業場 →（add）→ 準備棚 →（commit）→ 保存庫、と進む"},

    {"kicker": "はじめ方", "title": "init または clone で始める",
     "bullets": [
         "$ git init … 今のフォルダを、Gitで管理し始める（まっさらから）",
         "$ git clone URL … ネット上のプロジェクトを、丸ごと手元にコピーして始める",
         "どちらかを一度やれば、そのフォルダはGit管理下になる",
     ]},

    {"kicker": "手順①", "title": "git add ― 「これを保存する」と選ぶ",
     "bullets": [
         "ファイルを編集したら、$ git add ファイル名 で“準備棚”に載せる",
         "$ git add . （ドット）で、変更した全部をまとめて載せられる",
         "まだ保存は確定していない。“保存する候補を選んだ”段階",
     ]},

    {"kicker": "手順②", "title": "git commit ― 保存（スナップショットを撮る）",
     "bullets": [
         "$ git commit -m \"やったことの説明\" で、準備棚の内容を保存庫に記録",
         "-m のあとのメッセージに、“何をしたか”を短く書く（例：ログイン画面を追加）",
         "これで1つの履歴（コミット）が残る。あとで必ずこの時点に戻れる",
     ],
     "note": "メッセージは未来の自分・仲間へのメモ。「修正」だけでなく中身を書く"},

    {"kicker": "今どうなってる？", "title": "status と log で確認する",
     "bullets": [
         "$ git status … 今どのファイルが変更・add 済みかを教えてくれる（超よく使う）",
         "$ git log … これまでのコミット（保存の履歴）を一覧で見る",
         "迷ったら status。“今の状態”がひと目で分かる",
     ]},

    {"kicker": "第4回まとめ", "title": "編集 → add → commit のくり返し",
     "bullets": [
         "3つの場所：作業場 →（add）→ 準備棚 →（commit）→ 保存庫",
         "git add で選ぶ → git commit -m \"説明\" で保存する",
         "困ったら git status。次回は、保存した履歴をみんなで共有します（GitHub）",
     ]},
]

if __name__ == "__main__":
    build_deck(SLIDES, Path(__file__).resolve().parent / "slides.pptx")
