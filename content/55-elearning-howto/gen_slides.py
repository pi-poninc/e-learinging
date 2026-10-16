#!/usr/bin/env python3
"""eラーニングの作り方 ダイジェスト動画スライド（8枚）。"""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _deck import build_deck  # noqa: E402

FOOT = "pipon learning ｜ eラーニングの作り方"

SLIDES = [
    {"type": "title", "kicker": "eラーニングの作り方 ダイジェスト",
     "title": "台本から動画・講座登録まで",
     "sub": "本人クローン声で半自動に量産する", "foot": FOOT},

    {"kicker": "全体像", "title": "4ステップで作る",
     "rows": [("① 台本", "スライドと1対1・話し言葉"), ("② スライド", "gen_slides.py → pptx"), ("③ 生成/合成", "声→文字起こし→合成"), ("④ 登録", "Vimeo→レッスン登録")]},

    {"kicker": "① 台本", "title": "ここで8割決まる",
     "bullets": ["script_台本_cc.md は1行＝1スライド", "行数＝スライド枚数（必ず一致）", "話し言葉・1枚1メッセージ・締めは覚える3〜4つ"]},

    {"kicker": "② スライド", "title": "gen_slides.py で作る",
     "bullets": ["_deck.build_deck に辞書のリストを渡す", "型は title / bullets / rows", "1枚は要点3つまで"]},

    {"kicker": "③ 声と合成", "title": "本人クローン声で自動化",
     "bullets": ["Fish Audioで音声→whisperで文字起こし", "切替タイミングを自動推定", "背景・テロップ・（任意で）ワイプを合成"]},

    {"kicker": "レイアウト", "title": "縮小して余白を作る",
     "bullets": ["スライドを左上に縮小→右と下に余白", "右にワイプ・下にテロップ（重ならない）", "テロップ背景は黒を避ける"]},

    {"kicker": "④ 登録", "title": "build_course.py で一括",
     "bullets": ["--section-id / --start-order / --voice を指定", "生成→Vimeo限定公開→lessons登録まで", "長いのでバックグラウンド実行"]},

    {"type": "title", "kicker": "品質・運用｜まとめ",
     "title": "一般化・1対1・プレビュー・締めの要点",
     "sub": "顧客名/数値は必ず一般化。タイミングは目視で一手間", "foot": FOOT},
]

if __name__ == "__main__":
    out = Path(__file__).resolve().parent
    build_deck(SLIDES, out / "slides.pptx")
    print(f"slides.pptx 生成: {len(SLIDES)}枚")
