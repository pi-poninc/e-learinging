#!/usr/bin/env python3
"""ターミナル入門ダイジェスト動画スライド（9枚）。"""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _deck import build_deck  # noqa: E402

FOOT = "pipon learning ｜ ターミナル入門"

SLIDES = [
    {"type": "title", "kicker": "ターミナル入門ダイジェスト",
     "title": "黒い画面を、自分の道具に",
     "sub": "開き方から、安全ルールまで、ざっと全体像", "foot": FOOT},

    {"kicker": "なぜ？", "title": "ターミナルを使う理由",
     "bullets": ["フォルダ操作などを1行で速く・正確に", "Git や Claude Code はここから使う", "怖くない：打ったことしか起きない"]},

    {"kicker": "開き方", "title": "開いて、プロンプトを見る",
     "bullets": ["Mac：ターミナル.app（Spotlightで『terminal』）", "Windows：PowerShell（WSL / Git Bash も）", "行頭の % $ > の後ろに入力。前が『今いる場所』"]},

    {"kicker": "迷子3点", "title": "現在地と移動",
     "rows": [("pwd", "今どこにいる？"), ("ls", "何がある？"), ("cd 名前", "移動（.. で1つ上、~ でホーム）")]},

    {"kicker": "作る・見る・消す", "title": "基本の操作",
     "rows": [("mkdir", "フォルダを作る"), ("touch / New-Item", "ファイルを作る"),
              ("cat", "中身を見る"), ("rm", "消す（即削除・要注意）")]},

    {"kicker": "時短", "title": "速く・正確に打つ",
     "bullets": ["パス＝住所（絶対/相対・~＝ホーム）", "Tab キーで補完（打ち間違い激減）", "↑ キーで前のコマンドを再利用"]},

    {"kicker": "困ったとき", "title": "詰まっても落ち着く",
     "bullets": ["止めたい → Ctrl + C", "エラーは『最後の行』をよく読む", "sudo（管理者）は意味が分かるまで使わない"]},

    {"kicker": "安全", "title": "事故を防ぐ型",
     "bullets": ["rm -rf は最も危険・場所を確認せず実行しない", "コピペしたコマンドは理解してから", "確認（pwd/ls）→ 実行 → 確認"]},

    {"type": "title", "kicker": "はじめよう",
     "title": "まず pwd と ls、そして mkdir で1つ",
     "sub": "黒い画面に慣れたら、次は GitHub へ", "foot": FOOT},
]

if __name__ == "__main__":
    out = Path(__file__).resolve().parent
    build_deck(SLIDES, out / "slides.pptx")
    print(f"slides.pptx 生成: {len(SLIDES)}枚")
