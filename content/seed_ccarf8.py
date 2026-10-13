#!/usr/bin/env python3
"""CCAR-F 実装マスター（総合コース）: 課題1〜4 の解説・問題・課題を1本のコースに組み上げる。

各課題の本文/問題/課題は seed_ccarf3/4/5/6.py から再利用（単一ソース）。
  課題1 サポートエージェント      = seed_ccarf3
  課題2 Claude Code 設定          = seed_ccarf6
  課題3 構造化データ抽出          = seed_ccarf5
  課題4 マルチエージェント調査    = seed_ccarf4
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ADMIN_UUID = "bab3dae7-813b-43ee-b7f9-200ca779dcfd"
MEMBERS = [ADMIN_UUID, "8936dff0-704d-4d2f-bff0-c84869eec0fc", "fd11370b-58d9-4d8c-b95b-bdd851515f34"]
sys.path.insert(0, str(ROOT / "content"))
import build as b  # noqa: E402
import seed_ccarf3 as k1  # 課題1
import seed_ccarf6 as k2  # 課題2
import seed_ccarf5 as k3  # 課題3
import seed_ccarf4 as k4  # 課題4

env = b.load_env()


def lesson(section_id, title, body, order):
    b.sb(env, "POST", "lessons", {"section_id": section_id, "title": title, "body": body,
                                  "sort_order": order, "status": "published"})
    print(f"    lesson[{order}] {title}")


def assignment(section_id, title, desc, order):
    b.sb(env, "POST", "assignments", {"section_id": section_id, "title": title,
         "description": desc, "sort_order": order, "status": "published"})
    print(f"    assignment[{order}] {title}")


def quiz(section_id, title, desc, order, questions, passing=80):
    q = b.sb(env, "POST", "quizzes", {"section_id": section_id, "title": title, "description": desc,
             "passing_score": passing, "sort_order": order, "status": "published"})[0]
    for qi, qq in enumerate(questions):
        qrow = b.sb(env, "POST", "quiz_questions", {"quiz_id": q["id"], "question_type": qq["type"],
                    "question_text": qq["q"], "explanation": qq.get("exp", ""), "sort_order": qi, "points": 1})[0]
        for oi, (text, correct) in enumerate(qq["opts"]):
            b.sb(env, "POST", "quiz_options", {"question_id": qrow["id"], "option_text": text,
                 "is_correct": correct, "sort_order": oi})
    print(f"    quiz[{order}] {title} ({len(questions)}問)")


INTRO = r"""試験ガイド8章の**4つの練習課題（課題1〜4）**を、実装コードで通して理解する総合コースです。バラバラの4コースを1本に組み上げました。上から順に進めてください。

## このコースの地図

| 章 | 課題 | 読むコード | 中心テーマ | 対応分野 |
|---|---|---|---|---|
| 1 | 課題1 サポートエージェント | support_agent.py | ツール設計・フックで規則を強制・ループ | 1・2・5 |
| 2 | 課題2 Claude Code 設定 | ccarf_config.py | CLAUDE.md階層・ルール・スキル・MCP | 3・2 |
| 3 | 課題3 構造化データ抽出 | extraction_pipeline.py | スキーマ・検証/再試行・バッチ・確信度 | 4・5 |
| 4 | 課題4 マルチエージェント調査 | research_pipeline.py | 委任・並列・構造化出力・食い違い | 1・2・5 |

各章は、**コード解説5本 → コード読解クイズ17問 → ハンズオン課題**の順です（課題2は「設定の解説」）。

## 共通する3つの芯

1. **絶対の規則はコードで強制、状況判断はプロンプト**（フック／スキーマ／ルール）。
2. **失敗は構造化して返す**（種類・再試行可否・説明）。0件や該当なしは“正常”、アクセス失敗と区別する。
3. **揺れてはいけない部分はモデル抜きで単体テスト**（各章に `test_*_offline.py`。`OK: N checks passed`）。

## 手元で動かすには

```bash
pip install claude-agent-sdk     # 課題1・3・4 で必要（課題2は不要）
python test_offline.py           # 課題1
python test_config_offline.py    # 課題2（SDK不要）
python test_extraction_offline.py # 課題3
python test_research_offline.py  # 課題4
```

関連ロードマップ：**「CCAR-F 実装マスター（課題1〜4）」**（/journey）でも、週1本ペースの目標日つきで進められます。では、第1章から。
"""

CHAPTERS = [
    ("第1章 ｜ 課題1 サポートエージェント（support_agent.py）", k1,
     [("① このプログラムの全体像", k1.L0),
      ("② ツールの設計を読む（get_customer ほか）", k1.L1),
      ("③ フックで規則を強制する（PreToolUse / PostToolUse）", k1.L2),
      ("④ エージェントの組み立てと実行ループ", k1.L3),
      ("⑤ test_offline.py を読む", k1.L4)],
     "コード読解クイズ 17問（課題1）",
     "ハンズオン：ツール or ルールを1つ足してテストする（課題1）"),

    ("第2章 ｜ 課題2 Claude Code チーム設定（ccarf_config.py）", k2,
     [("① 全体像（共有と個人の2系統）", k2.L0),
      ("② CLAUDE.md の階層と @import", k2.L1),
      ("③ ルールファイル（paths の glob）", k2.L2),
      ("④ スキル（context: fork / allowed-tools）", k2.L3),
      ("⑤ MCP設定（共有/個人）と plan mode の使い分け", k2.L4)],
     "設定 読解クイズ 17問（課題2）",
     "ハンズオン：ルール or スキル or 監査関数を足してテストする（課題2）"),

    ("第3章 ｜ 課題3 構造化データ抽出（extraction_pipeline.py）", k3,
     [("① このプログラムの全体像", k3.L0),
      ("② スキーマ設計（必須/任意・列挙+other・nullable）", k3.L1),
      ("③ 抽出と再試行ループ（形式は直る・欠落は捏造しない）", k3.L2),
      ("④ 確信度ルーティングとバッチ（失敗分だけ再提出）", k3.L3),
      ("⑤ test_extraction_offline.py を読む", k3.L4)],
     "コード読解クイズ 17問（課題3）",
     "ハンズオン：スキーマ or 意味検証 or ルーティングを足してテストする（課題3）"),

    ("第4章 ｜ 課題4 マルチエージェント調査（research_pipeline.py）", k4,
     [("① このプログラムの全体像", k4.L0),
      ("② 検索ツールと構造化データ（web_search）", k4.L1),
      ("③ サブエージェントとコーディネーター（委任と並列）", k4.L2),
      ("④ 統合ロジック（食い違いと出典）", k4.L3),
      ("⑤ test_research_offline.py を読む", k4.L4)],
     "コード読解クイズ 17問（課題4）",
     "ハンズオン：サブトピック or 統合ロジック or サブエージェントを足してテストする（課題4）"),
]


def main():
    c = b.sb(env, "POST", "courses", {
        "title": "CCAR-F 実装マスター ｜ 課題1〜4 総合コース",
        "description": "試験ガイド8章の練習課題4つ（サポートエージェント／Claude Code設定／構造化データ抽出／"
                       "マルチエージェント調査）を、実装コードで通して理解する総合コース。各章=コード解説5本＋"
                       "読解17問＋ハンズオン課題。すべてのオフラインテストは動作確認済み。",
        "status": "published", "is_sequential": False, "created_by": ADMIN_UUID})[0]
    print(f"講座作成: {c['id']}")

    # はじめに
    sec0 = b.sb(env, "POST", "sections", {"course_id": c["id"], "title": "はじめに", "sort_order": 0})[0]["id"]
    print("[はじめに]")
    lesson(sec0, "このコースの地図と進め方", INTRO, 0)

    for i, (sec_title, mod, lessons, quiz_title, assign_title) in enumerate(CHAPTERS, start=1):
        sid = b.sb(env, "POST", "sections", {"course_id": c["id"], "title": sec_title, "sort_order": i})[0]["id"]
        print(f"[{sec_title}]  {sid}")
        order = 0
        for (ltitle, lbody) in lessons:
            lesson(sid, ltitle, lbody, order); order += 1
        quiz(sid, quiz_title, "解説付き。合格目安8割。", order, mod.QUIZ); order += 1
        assignment(sid, assign_title, mod.ASSIGN, order)

    for uid in MEMBERS:
        b.sb(env, "POST", "enrollments", {"user_id": uid, "course_id": c["id"], "status": "active"})
    print(f"受講登録: {len(MEMBERS)}名\n受講URL: /courses/{c['id']}\n完成 🎓")


if __name__ == "__main__":
    main()
