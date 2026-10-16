#!/usr/bin/env python3
"""成分分析入門 LIBS/XRF ダイジェスト動画スライド（6枚）。"""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _deck import build_deck  # noqa: E402

FOOT = "pipon learning ｜ 成分分析入門 LIBS/XRF"

SLIDES = [
    {"type": "title", "kicker": "成分分析入門 ダイジェスト",
     "title": "LIBS/XRF と品種判別",
     "sub": "見た目では分からない部材を見分ける", "foot": FOOT},

    {"kicker": "① なぜ", "title": "画像AIだけでは判別できない",
     "bullets": ["外見が似ていても成分が違う", "コーティングで下地が見えない", "だから刻印を読むか、成分を測る"]},

    {"kicker": "② XRF", "title": "蛍光X線分析",
     "bullets": ["X線を当て、返る蛍光X線で元素と量を読む", "非破壊・ハンディ機で現場測定", "軽元素(炭素等)が苦手・コーティング影響"]},

    {"kicker": "③ LIBS", "title": "レーザーで光らせて読む",
     "rows": [("当てる", "強いレーザーでプラズマ化"), ("読む", "発光スペクトル(色)"), ("軽元素", "比較的得意"), ("使い分け", "XRFと特性を理解して選ぶ")]},

    {"kicker": "④ 品種判別", "title": "刻印＋成分＋運用",
     "bullets": ["まず刻印を読む（読めれば確実）", "読めない個体だけ成分分析へ", "確信度が低いものは人へ（見た目頼みにしない）"]},

    {"type": "title", "kicker": "まとめ",
     "title": "画像の限界→XRF→LIBS→刻印+成分で判別",
     "sub": "製造業前提知識シリーズ（電気設備・TA選別の姉妹編）", "foot": FOOT},
]

if __name__ == "__main__":
    out = Path(__file__).resolve().parent
    build_deck(SLIDES, out / "slides.pptx")
    print(f"slides.pptx 生成: {len(SLIDES)}枚")
