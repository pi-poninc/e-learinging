#!/usr/bin/env python3
"""VS Code入門ダイジェスト動画スライド（9枚）。"""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _deck import build_deck  # noqa: E402

FOOT = "pipon learning ｜ VS Code入門"

SLIDES = [
    {"type": "title", "kicker": "VS Code入門ダイジェスト",
     "title": "編集も、コマンドも、Gitも、1画面で",
     "sub": "無料エディタを『作業場』にする全体像", "foot": FOOT},

    {"kicker": "なに？", "title": "VS Code とは",
     "bullets": ["無料のテキスト／コード編集ソフト（Win/Mac共通）", "拡張機能で必要な機能だけ足せる", "ターミナル内蔵・Git連携で1画面完結"]},

    {"kicker": "導入", "title": "入れて、日本語にして、見る",
     "bullets": ["code.visualstudio.com から入れる", "拡張 Japanese Language Pack で日本語化", "左の帯で切替、中央で編集、下にターミナル"]},

    {"kicker": "基本", "title": "フォルダを開いて編集・保存",
     "rows": [("フォルダーを開く", "左にファイル一覧（エクスプローラー）"),
              ("⌘/Ctrl + S", "保存（自動保存もオンにできる）"),
              ("タブ / 分割", "複数ファイルを並べて編集")]},

    {"kicker": "探す・呼ぶ", "title": "コマンドパレットが主役",
     "bullets": ["Ctrl/⌘ + F：検索（+Shift+F で全体検索）", "Ctrl/⌘ + P：ファイルを名前で開く", "Ctrl/⌘ + Shift + P：何でもここから（迷ったらこれ）"]},

    {"kicker": "ターミナル", "title": "内蔵ターミナルで完結",
     "bullets": ["Ctrl + @（バッククォート）で開く", "開いているフォルダがそのまま作業場所", "claude や git をこの画面で実行"]},

    {"kicker": "拡張 & Git", "title": "足す・記録する",
     "bullets": ["拡張：日本語・Prettier 等（信頼できるものだけ）", "ソース管理タブ＝変更→コミット→同期", "黒い画面なしで Git が使える"]},

    {"kicker": "安全", "title": "気をつけること",
     "bullets": ["知らないフォルダは『ワークスペースの信頼』で制限モード", "怪しい発行元の拡張は入れない", "設定同期で別PCにも引き継げる"]},

    {"type": "title", "kicker": "覚える4つ",
     "title": "開く・保存・ターミナル・パレット",
     "sub": "まずこれで、日常の作業は十分回る", "foot": FOOT},
]

if __name__ == "__main__":
    out = Path(__file__).resolve().parent
    build_deck(SLIDES, out / "slides.pptx")
    print(f"slides.pptx 生成: {len(SLIDES)}枚")
