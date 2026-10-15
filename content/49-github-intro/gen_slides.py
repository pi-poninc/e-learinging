#!/usr/bin/env python3
"""GitHub入門ダイジェスト動画スライド（9枚）。"""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _deck import build_deck  # noqa: E402

FOOT = "pipon learning ｜ GitHub入門"

SLIDES = [
    {"type": "title", "kicker": "GitHub入門ダイジェスト",
     "title": "黒い画面なしで、保存・共有・共同作業",
     "sub": "ブラウザと GitHub Desktop だけで使えるようになる", "foot": FOOT},

    {"kicker": "なに？", "title": "GitHub がうれしい3つの理由",
     "bullets": ["履歴が残る・いつでも前に戻せる", "同じファイルを複数人で安全に扱える", "公開できる（ポートフォリオにもなる）"]},

    {"kicker": "まず言葉4つ", "title": "これだけ覚える",
     "rows": [("リポジトリ", "プロジェクトの保管箱"), ("コミット", "変更の記録＋一言メッセージ"),
              ("プッシュ", "クラウド（GitHub）へ反映"), ("クローン", "自分のPCに取り込む")]},

    {"kicker": "はじめ方", "title": "アカウントと安全設定",
     "bullets": ["github.com で Sign up", "2段階認証（2FA）を必ずオンに", "見せたくないものは Private（非公開）"]},

    {"kicker": "リポジトリ", "title": "保管箱を作る",
     "bullets": ["New repository ＋ Add a README", "README は Markdown で書く『説明書』", "タブ：Code / Issues / Pull requests"]},

    {"kicker": "ブラウザだけ", "title": "作成・編集・コミット",
     "bullets": ["Add file → 編集", "Commit changes＝保存して記録", "履歴（Commits）から前に戻せる"]},

    {"kicker": "GitHub Desktop", "title": "PCと同期（黒い画面ゼロ）",
     "bullets": ["Clone でPCに取り込む", "編集 → Commit → Push origin", "始める前に Pull しておく"]},

    {"kicker": "共同作業", "title": "Issues・ブランチ・Pull Request",
     "bullets": ["Issues＝やること・バグの付箋", "ブランチ＝main を壊さず試すコピー", "Pull Request＝変更の提案 → レビュー → マージ"]},

    {"type": "title", "kicker": "安全＆はじめよう",
     "title": "小さく・こまめに・まず1つ作る",
     "sub": "秘密情報は上げない／Privateを使う／今日リポジトリを1つ作ろう", "foot": FOOT},
]

if __name__ == "__main__":
    out = Path(__file__).resolve().parent
    build_deck(SLIDES, out / "slides.pptx")
    print(f"slides.pptx 生成: {len(SLIDES)}枚")
