#!/usr/bin/env python3
"""AIのハルシネーション対策 ダイジェスト動画スライド（6枚）。"""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _deck import build_deck  # noqa: E402

FOOT = "pipon learning ｜ ハルシネーション対策"

SLIDES = [
    {"type": "title", "kicker": "ハルシネーション対策 ダイジェスト",
     "title": "モデル変更時の精度検証",
     "sub": "AIは間違える前提で、設計と運用で抑える", "foot": FOOT},

    {"kicker": "① 性質", "title": "なぜ起きる",
     "bullets": ["次に来そうな言葉を確率で選ぶ（事実DBではない）", "曖昧な入力でも空白を埋めて作る", "音声の聞き間違い・OCR誤読も同種"]},

    {"kicker": "② モデル変更", "title": "“良くなるはず”の落とし穴",
     "bullets": ["全体は良くても特定の語で悪化しうる", "一般に良い≠あなたの業務で良い", "感覚で切り替えると本番で事故る"]},

    {"kicker": "③ 検証の型", "title": "評価データ＋指標＋回帰テスト",
     "rows": [("評価データ", "正解付き・苦手ケース込み"), ("指標", "用途に合う物差し"), ("回帰テスト", "新旧を同条件で比較"), ("見方", "平均だけでなくケース差分")]},

    {"kicker": "④ 運用", "title": "運用で抑える",
     "bullets": ["『分からなければ分からないと言う』＋根拠を出させ照合", "確信度が低いものは人のレビューへ", "フォールバックと本番の継続監視"]},

    {"type": "title", "kicker": "まとめ",
     "title": "性質を知る→比較必須→検証→運用で抑える",
     "sub": "ゼロにはできない。検証して選び、怪しいものは人へ", "foot": FOOT},
]

if __name__ == "__main__":
    out = Path(__file__).resolve().parent
    build_deck(SLIDES, out / "slides.pptx")
    print(f"slides.pptx 生成: {len(SLIDES)}枚")
