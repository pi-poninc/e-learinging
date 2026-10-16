#!/usr/bin/env python3
"""要求と設計の型 ダイジェスト動画スライド（6枚）。"""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _deck import build_deck  # noqa: E402

FOOT = "pipon learning ｜ 要求と設計の型"

SLIDES = [
    {"type": "title", "kicker": "要求と設計の型 ダイジェスト",
     "title": "分類に落とす・全体絵・過剰設計を防ぐ",
     "sub": "バラバラの要求を設計に使える形へ", "foot": FOOT},

    {"kicker": "① 分類", "title": "要求をレーンに落とす",
     "bullets": ["並べるだけでは重複・粒度バラバラ・抜け", "業務のまとまりでレーンを作り配る", "「その他」は保留置き場（膨らむ＝軸が合ってない）"]},

    {"kicker": "② 全体絵", "title": "Figmaでモジュール化",
     "bullets": ["画面/モジュールを箱で並べ関係を描く", "顧客と一緒に見て解釈のズレを防ぐ", "粗く全体→過不足が見える。仕様でなく地図"]},

    {"kicker": "③ 過剰設計", "title": "最小で作る",
     "bullets": ["今回のスコープか？を常に問う", "最も単純で要件を満たす技術を選ぶ", "迷ったら後から足せる方（減らすは難しい）"]},

    {"kicker": "④ 橋渡し", "title": "設計へつなぐ",
     "rows": [("スコープ", "やる/やらないの線引き"), ("WBS", "分類と全体絵から作業に分解"), ("未決", "決まってない前提を一覧化"), ("AI活用", "要件素案・論点をAIで起こし人が確認")]},

    {"type": "title", "kicker": "まとめ",
     "title": "分類→全体絵→最小設計→未決を添えて走る",
     "sub": "顧客ワークショップ講座の実践編", "foot": FOOT},
]

if __name__ == "__main__":
    out = Path(__file__).resolve().parent
    build_deck(SLIDES, out / "slides.pptx")
    print(f"slides.pptx 生成: {len(SLIDES)}枚")
