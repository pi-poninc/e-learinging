#!/usr/bin/env python3
"""AIプロダクトのデータ基盤「Everything is an event」ダイジェスト動画スライド（8枚）。"""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _deck import build_deck  # noqa: E402

FOOT = "pipon learning ｜ AIデータ基盤 Everything is an event"

SLIDES = [
    {"type": "title", "kicker": "AIデータ基盤 ダイジェスト",
     "title": "Everything is an event",
     "sub": "監視・分析・顧客向け・課金を1つの基盤で", "foot": FOOT},

    {"kicker": "なぜ", "title": "別々に作ると破綻する",
     "bullets": ["障害監視・機能分析・顧客ダッシュボード・課金を個別実装→数字がズレる", "あらゆる行動を1本のイベントに残す", "意味づけ（集計）は後から何通りでも"]},

    {"kicker": "① 設計", "title": "後から何にでも使える形で残す",
     "rows": [("基本項目", "time / type / tenant / properties"), ("命名", "名詞.動詞で揃える"), ("方針", "広く薄く・追記のみ(immutable)"), ("注意", "PIIはマスキング・保持期間")]},

    {"kicker": "② 置き場所", "title": "ClickHouse と Postgres",
     "rows": [("Postgres", "業務の正データ・トランザクション"), ("ClickHouse", "大量イベントの集計(列指向)"), ("方針", "無理に1つにしない"), ("投入", "まとめて・event_idで冪等")]},

    {"kicker": "③ 集計", "title": "Materialized View で作り置き",
     "bullets": ["生イベントは量が多く毎回スキャンは重い", "分/時/日×テナント×種類で事前集計", "ダッシュボードは小さな集計表を読むだけ＝速い"]},

    {"kicker": "④ 活用", "title": "1つの基盤で4役",
     "bullets": ["障害監視：エラー率・レイテンシ", "プロダクト分析／顧客向けAnalytics(tenantで切る)", "課金KPI：同じ事実から算出"]},

    {"kicker": "⑤ 課金", "title": "成果/使用量ベースと指標設計",
     "bullets": ["課金対象アクションをevent_typeで定義", "「1件の定義」を顧客と合意", "請求と顧客ダッシュボードは同じ数字"]},

    {"type": "title", "kicker": "まとめ",
     "title": "残す→正はPG・量はCH→MVで集計→1基盤で4役",
     "sub": "課金KPIも監視・分析と同じイベントから。別計算にしない", "foot": FOOT},
]

if __name__ == "__main__":
    out = Path(__file__).resolve().parent
    build_deck(SLIDES, out / "slides.pptx")
    print(f"slides.pptx 生成: {len(SLIDES)}枚")
