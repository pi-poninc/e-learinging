#!/usr/bin/env python3
"""受託PMの作法 ダイジェスト動画スライド（7枚）。"""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _deck import build_deck  # noqa: E402

FOOT = "pipon learning ｜ 受託PMの作法"

SLIDES = [
    {"type": "title", "kicker": "受託PMの作法 ダイジェスト",
     "title": "速く作るより、止めずに回す",
     "sub": "情報を一か所に・未決を可視化・まず全体", "foot": FOOT},

    {"kicker": "よくある詰まり", "title": "なぜ止まるのか",
     "bullets": ["決定事項がどこにあるか分からない", "顧客確認待ちで手が止まる", "完璧に整えてから渡すので遅い"]},

    {"kicker": "① 顧客確認", "title": "一か所に集約・未決を可視化",
     "bullets": ["決定事項シートを日次更新（口頭も書き写す）", "未決は担当・期限・影響を付けて頭出し", "白紙で聞かず、代替案を2つ出して選ばせる"]},

    {"kicker": "② 中間納品", "title": "未確定事項一覧を添える",
     "bullets": ["固まってなくても止めずに中間で出す", "仮置き・確認待ちを明示（色・注記）", "早いフィードバックで方向違いを早期発見"]},

    {"kicker": "③ 速いQA", "title": "全部起票→PM確認→絞る",
     "bullets": ["整形してから登録しない（遅い）", "まず全部起票して全体を可視化", "分からない質問だけ精査する"]},

    {"kicker": "④ 外部連携", "title": "仕組みで回す",
     "bullets": ["責任分担表で“誰が何を”を明確に", "「内部確認中」等で相手/自分ボールを区別", "必要ツールの招待を最初に一覧で徹底"]},

    {"type": "title", "kicker": "まとめ",
     "title": "集約→未確定を添えて早く→全部起票→仕組みで連携",
     "sub": "完璧より、まず全体を可視化して回す", "foot": FOOT},
]

if __name__ == "__main__":
    out = Path(__file__).resolve().parent
    build_deck(SLIDES, out / "slides.pptx")
    print(f"slides.pptx 生成: {len(SLIDES)}枚")
