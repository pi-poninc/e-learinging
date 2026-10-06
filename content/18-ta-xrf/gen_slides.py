#!/usr/bin/env python3
"""TA選別 第6回 品質管理とXRF/LIBS。出典: PROJECT_VISION.md 6〜7章, XRF_QUALITY.md。
台本の行数=スライド枚数(7)に一致させること。"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _deck import build_deck  # noqa: E402

SLIDES = [
    {"type": "title", "kicker": "超硬チップAI選別（TA選別）入門 ｜ 第6回",
     "title": "品質管理とXRF / LIBS",
     "sub": "― ラベルループでAIが熟練者を超える",
     "foot": "株式会社pipon｜pipon learning"},

    {"kicker": "XRFループ", "title": "AIと熟練者が食い違った個体を、XRFで白黒つける",
     "bullets": [
         "学習後、AIの判定と熟練者の判定が食い違った個体を抽出する",
         "その個体をXRF（成分分析）で測定し、どちらが正しいかを確定する",
         "正しいラベルに直して、再学習する。これを回し続ける",
     ]},

    {"kicker": "なぜ効くか", "title": "この循環で、AIが熟練者を“超える”",
     "bullets": [
         "熟練者でも、数%は判定を誤る（人間だから当然）",
         "食い違いをXRFで潰すたびに、学習ラベルの質が上がっていく",
         "結果として、AIは熟練者の平均を超える精度に到達しうる",
     ],
     "note": "“人の判断を正解とする”限界を、客観的な成分分析で突破する"},

    {"kicker": "補完技術①", "title": "XRF（蛍光X線）：ハンドヘルドで数秒測定",
     "bullets": [
         "W・Co・Ti・Ta などの元素を、数秒で測れる。刻印の状態に依存しない",
         "留意点：表面コーティングの影響を受ける／炭素(C)は測れない",
         "用途：ラベル品質管理、見た目がそっくりな品種ペアの確定、保留品の処理",
     ]},

    {"kicker": "補完技術②", "title": "LIBS（レーザー分光）：母材を直接・高速",
     "bullets": [
         "レーザーでコーティングを貫通し、母材の成分を直接測定できる",
         "ミリ秒で判定でき、全自動ライン向き",
         "ただし装置は高価（数百万〜1,000万円超）",
     ]},

    {"kicker": "費用感の目安", "title": "まずはハンドヘルドXRFを短期レンタル",
     "rows": [
         ("XRF レンタル", "月 20〜40万円（まずはこれで品質管理ループを確立）"),
         ("XRF 中古 / 新品", "中古 100〜250万円 ／ 新品 300〜600万円"),
         ("LIBS", "数百万〜1,000万円超（全自動ラインの段階で検討）"),
     ]},

    {"kicker": "第6回まとめ", "title": "成分分析で“正解の質”を担保する",
     "bullets": [
         "AIと熟練者の食い違いをXRFで確定し、ラベルを直して再学習（XRFループ）",
         "この循環で、AIは熟練者を超える精度に到達しうる",
         "XRFは数秒・手持ちで品質管理に、LIBSは高速・全自動ライン向き",
     ]},
]

if __name__ == "__main__":
    build_deck(SLIDES, Path(__file__).resolve().parent / "slides.pptx")
