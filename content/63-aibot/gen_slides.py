#!/usr/bin/env python3
"""AIボットの始め方と役割分担 ダイジェスト動画スライド（8枚）。"""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _deck import build_deck  # noqa: E402

FOOT = "pipon learning ｜ AIボットの始め方と役割分担"

SLIDES = [
    {"type": "title", "kicker": "AIボットの始め方 ダイジェスト",
     "title": "1体に全部頼まない。役割で分ける",
     "sub": "会社の組織のように、ボットを分けて任せる", "foot": FOOT},

    {"kicker": "なぜ分ける", "title": "1体に全部だと崩れる",
     "bullets": ["指示がぶれる・報告が長い・任せた範囲が不明", "役割ごとに やること/やらないこと を固定", "報告の型をそろえ、1体ずつ足せる"]},

    {"kicker": "組織図", "title": "6つの役割",
     "rows": [("まとめ役", "振り分け(自分では作業しない)"), ("秘書役", "返信・期限・報告"), ("取りまとめ/作業/QA", "制作・開発・品質"), ("巡回bot", "定期巡回→秘書役へ")]},

    {"kicker": "最初の1体", "title": "契約はWeb・プロフィールが要",
     "bullets": ["契約はブラウザから(アプリは手数料で割高)", "プロフィール3要素＝役割／やること・やらないこと／報告の型", "まず『まとめ役』1体から始める"]},

    {"kicker": "つなぐ・回す", "title": "チャットで頼む",
     "bullets": ["コネクタ：「Gmailをつないで」本人が許可", "ルーティン：「毎朝8時に未読と予定を」小さく始める", "まず“読むだけ”で試す"]},

    {"kicker": "増やす", "title": "2体目以降は連携を書く",
     "bullets": ["説明欄に『誰に頼み・誰に報告するか』", "ボット同士の連絡もチャットで頼む", "巡回botの結果は秘書役にまとめて渡す"]},

    {"kicker": "効かせる", "title": "情報を設計し、送信は確認",
     "bullets": ["約束事は1か所に短く・記録はメモ置き場・毎回読ませる", "外部送信/支払いは必ず文面と宛先を確認(下書きまでは任せる)", "削除せずアーカイブ・分からなければ要確認"]},

    {"type": "title", "kicker": "覚える4つ｜まとめ",
     "title": "分ける・頼む・設計する・確認する",
     "sub": "まず1体のプロフィールを書いて、朝のルーティンを1つ作る", "foot": FOOT},
]

if __name__ == "__main__":
    out = Path(__file__).resolve().parent
    build_deck(SLIDES, out / "slides.pptx")
    print(f"slides.pptx 生成: {len(SLIDES)}枚")
