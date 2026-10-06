#!/usr/bin/env python3
"""はじめてのGitとコマンド 第5回 GitHubと共有。素人向け。
台本の行数=スライド枚数(6)に一致させること。"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _deck import build_deck  # noqa: E402

SLIDES = [
    {"type": "title", "kicker": "はじめてのGitとコマンド ｜ 第5回",
     "title": "GitHubと共有",
     "sub": "― クラウドに置いて、みんなで使う",
     "foot": "株式会社pipon｜pipon learning（まったくの初心者向け）"},

    {"kicker": "GitHubとは", "title": "Gitの保存庫を、クラウドに置く場所",
     "bullets": [
         "GitHub（ギットハブ）は、Gitの保存庫をインターネット上に置けるサービス",
         "手元のパソコンが壊れても、クラウドに残る＝バックアップになる",
         "URLで共有すれば、チームの全員が同じプロジェクトを使える",
     ],
     "note": "Git（道具）と GitHub（置き場所）は別物。混同しやすいので注意"},

    {"kicker": "2つの場所", "title": "ローカル（手元）とリモート（クラウド）",
     "rows": [
         ("ローカル", "自分のパソコンの中。ここで編集し、add / commit する"),
         ("リモート", "GitHub上（クラウド）。みんなが見られる共有の置き場所"),
         ("やること", "手元で作って、クラウドへ送る／クラウドから受け取る"),
     ]},

    {"kicker": "手元 → クラウド", "title": "git push ― 保存した履歴をクラウドへ送る",
     "bullets": [
         "手元で commit したあと、$ git push で GitHub に送る（アップロード）",
         "これで、クラウド側にも同じ履歴が反映される",
         "他の人は、それを見たり、受け取ったりできる",
     ]},

    {"kicker": "クラウド → 手元", "title": "git pull ― 最新を受け取る／clone で丸ごとコピー",
     "bullets": [
         "$ git pull … クラウドの最新の変更を、手元に取り込む（ダウンロード）",
         "$ git clone URL … まだ手元に無いプロジェクトを、丸ごとコピーしてくる",
         "作業を始める前に pull で最新にそろえる、が基本マナー",
     ]},

    {"kicker": "第5回まとめ", "title": "push で送り、pull で受け取る",
     "bullets": [
         "GitHub＝Gitの保存庫を置くクラウド。バックアップにも共有にもなる",
         "ローカル（手元）⇄ リモート（クラウド）を push / pull で行き来する",
         "1人でもバックアップとして便利、複数人なら共同作業の土台になる",
     ]},
]

if __name__ == "__main__":
    build_deck(SLIDES, Path(__file__).resolve().parent / "slides.pptx")
