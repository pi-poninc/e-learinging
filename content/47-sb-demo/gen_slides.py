#!/usr/bin/env python3
"""第二の脳 実演デモ（画面録画ワイプと合成する前提）。
スライドは「今、画面で何をしているか」のステップ見出しに徹する（主役は画面録画のワイプ）。
台本の行数=スライド枚数(8)に一致させること。"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _deck import build_deck  # noqa: E402

SLIDES = [
    {"type": "title", "kicker": "第二の脳の作り方 ｜ 実演デモ",
     "title": "第二の脳の「1日」を動かす",
     "sub": "― 画面で、実際にやってみる", "foot": "株式会社pipon｜pipon learning"},

    {"kicker": "STEP 1 ― ためる", "title": "思いついたら、Inboxへ",
     "bullets": ["00_Inbox に新しいノートを1枚作る",
                 "思いついたことを、一行でメモする",
                 "整理はしない。まず放り込む"]},

    {"kicker": "STEP 2 ― まわす", "title": "Daily Note に、今日のTop3",
     "bullets": ["10_Daily に今日の日付でノートを作る",
                 "テンプレートから、今日やることを書く",
                 "最重要の3つ＝今日のTop3を決める"]},

    {"kicker": "STEP 3 ― つなげる", "title": "Permanent Note を1枚",
     "bullets": ["Inboxのメモを、自分の言葉で言い直す",
                 "一言／説明／具体例／関連、の4つを埋める",
                 "50_PermanentNotes に保存する"]},

    {"kicker": "STEP 4 ― 結ぶ", "title": "[[リンク]] でつなぐ",
     "bullets": ["関連する言葉を [[二重カッコ]] で囲む",
                 "リンクをたどって、関連ノートへ飛ぶ",
                 "バックリンクで「どこから参照されたか」も見える"]},

    {"kicker": "STEP 5 ― 俯瞰する", "title": "グラフビューで全体を見る",
     "bullets": ["ノートを点、リンクを線で表示",
                 "よくつながる点＝関心の中心",
                 "孤立した点＝次につなぐ候補"]},

    {"kicker": "STEP 6 ― 生かす（上級）", "title": "AIに、一言で聞く",
     "bullets": ["Claude Code で Vault を開く",
                 "/ask-vault 今週の要点は？ と聞く",
                 "Vault全体を横断して、まとめて答えてくれる"],
     "note": "機微情報が映る場合は、安全な問い合わせに差し替えてください"},

    {"kicker": "まとめ", "title": "貯めて、つなげて、引き出す",
     "bullets": ["手で貯める（Inbox）→ つなげる（Permanent・リンク）",
                 "AIで引き出す（横断検索・分析）",
                 "これが、第二の脳の1日。今日から、あなたも"]},
]

if __name__ == "__main__":
    build_deck(SLIDES, Path(__file__).resolve().parent / "slides.pptx")
