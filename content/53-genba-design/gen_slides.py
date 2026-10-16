#!/usr/bin/env python3
"""現場起点の機能設計 ダイジェスト動画スライド（8枚）。"""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _deck import build_deck  # noqa: E402

FOOT = "pipon learning ｜ 現場起点の機能設計"

SLIDES = [
    {"type": "title", "kicker": "現場起点の機能設計 ダイジェスト",
     "title": "困りごとを、使われる機能に変える",
     "sub": "観る→翻訳→最小設計→横展開", "foot": FOOT},

    {"kicker": "考え方", "title": "仕様書ではなく“困りごと”から",
     "bullets": ["あったら便利を並べても現場は使わない", "手作業・ミス・待ちに機能の種がある", "観る→翻訳→最小で作る→小さく出して育てる"]},

    {"kicker": "① 観る", "title": "紙・Excel・電話の“あるある”",
     "bullets": ["同じ情報を2回入力していないか", "ミスが起きやすい所（納品先・金額・単位）", "待ち・暗黙ルールを拾う。例外こそ聞く"]},

    {"kicker": "② 翻訳", "title": "入力 → 処理 → 出力",
     "rows": [("入力", "何が来る？形式・頻度・量"), ("処理", "判断・変換・突合"), ("出力", "どこへ・どんな形で返す"), ("分担", "大量単純=機械／判断例外=人")]},

    {"kicker": "③ 最小設計", "title": "過剰設計を防ぐ",
     "bullets": ["ステータス/区分は現場が区別している数だけ", "迷ったら少ない方（後で足す方が簡単）", "手間が減らないなら要件ではない"]},

    {"kicker": "④ データ", "title": "マスタ・単位・区分",
     "bullets": ["同じ情報は1か所に持って参照", "単位は変換係数を一元化（手計算させない）", "安易な「その他」を作らない"]},

    {"kicker": "⑤ 例外と運用", "title": "失敗する時を設計する",
     "bullets": ["自信がないデータは人のレビュー列へ", "差戻し・通知・ログ（お金/個人情報）", "既存フローにそっと乗せる"]},

    {"type": "title", "kicker": "⑥ 育てる｜まとめ",
     "title": "ど真ん中をPoC → 検証 → 横展開",
     "sub": "「入力→処理→出力」の型は顧客が違っても再利用できる", "foot": FOOT},
]

if __name__ == "__main__":
    out = Path(__file__).resolve().parent
    build_deck(SLIDES, out / "slides.pptx")
    print(f"slides.pptx 生成: {len(SLIDES)}枚")
