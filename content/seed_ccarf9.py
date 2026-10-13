#!/usr/bin/env python3
"""CCAR-F 仕上げ3点:
  (1) 合格ロードマップ path（勉強の全体順：模擬→実装→直前）
  (2) 弱点マップ lesson（間違え方→弱点→戻る場所）を直前対策コースに追加
  (3) English rapid review クイズを総合コースに「総仕上げ」章として追加
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ADMIN_UUID = "bab3dae7-813b-43ee-b7f9-200ca779dcfd"
MEMBERS = [ADMIN_UUID, "8936dff0-704d-4d2f-bff0-c84869eec0fc", "fd11370b-58d9-4d8c-b95b-bdd851515f34"]

C_MOCK   = "b09120ec-ce6f-4363-a7e2-17e69a99fc05"  # 模擬問題集
C_PREP   = "c96c4c0b-8d96-4c4e-88f4-3f92062df994"  # 直前対策
C_MASTER = "431df093-d399-49fd-94cc-e7150b312667"  # 実装マスター総合
PREP_SEC2 = "aa03f37a-e594-4775-9188-7f7a4b8b6d69"  # 直前対策コースの「直前対策」セクション

sys.path.insert(0, str(ROOT / "content"))
import build as b  # noqa: E402

env = b.load_env()


def s(correct, *opts):
    return [(t, i == correct) for i, t in enumerate(opts)]


def mm(cset, *opts):
    return [(t, i in cset) for i, t in enumerate(opts)]


def lesson(section_id, title, body, order):
    b.sb(env, "POST", "lessons", {"section_id": section_id, "title": title, "body": body,
                                  "sort_order": order, "status": "published"})
    print(f"  lesson {title}")


def quiz(section_id, title, desc, order, questions, passing=80, minutes=None):
    payload = {"section_id": section_id, "title": title, "description": desc,
               "passing_score": passing, "sort_order": order, "status": "published"}
    if minutes is not None:
        payload["time_limit_minutes"] = minutes
    q = b.sb(env, "POST", "quizzes", payload)[0]
    for qi, qq in enumerate(questions):
        qrow = b.sb(env, "POST", "quiz_questions", {"quiz_id": q["id"], "question_type": qq["type"],
                    "question_text": qq["q"], "explanation": qq.get("exp", ""), "sort_order": qi, "points": 1})[0]
        for oi, (text, correct) in enumerate(qq["opts"]):
            b.sb(env, "POST", "quiz_options", {"question_id": qrow["id"], "option_text": text,
                 "is_correct": correct, "sort_order": oi})
    print(f"  quiz {title} ({len(questions)}問)")


# ===========================================================================
# (2) 弱点マップ レッスン
# ===========================================================================
WEAK = r"""間違えた問題の**種類**から、弱点と「戻る場所」を引く表です。模試や最難関15問で落としたら、ここから復習に戻ってください。

## 最難関15問：間違え方 → 弱点 → 戻る場所

| 間違えた問題 | 弱点 | 戻る場所 |
|---|---|---|
| H1・H14・H15 | セッションと状態の使い分け | 「見分け方シート」の“セッション”“長い作業” |
| H3・H7 | 強い対策を選びすぎる（過剰） | 「問題の大きさに見合った対策」／模試 第2弾 Q2・Q3 |
| H4・H12 | tool_choice と構造化出力 | 「暗記シート」の Agent SDK と API |
| H5・H6 | バッチと再試行の判断基準 | 「見分け方シート」の“API の選択”“再試行” |
| H8・H9 | エラーの種類の区別（失敗/0件） | 「見分け方シート」の“エラー” |
| H2・H10・H11 | 条件の読み落とし | 問題文の条件語（already / about once a month など）に印を付けて読む |
| H13 | 確信度の扱い | 「見分け方シート」の“確信度” |

## 分野別：よく落とす論点 → 戻る場所（コース）

| 分野 | よく落とす論点 | 戻る場所 |
|---|---|---|
| 1 Agentic Architecture | ループ制御・委任・並列・フックで規則強制 | 実装① サポートエージェント／実装② 調査パイプライン |
| 2 Tool & MCP | 説明文の書き分け・構造化エラー・tool_choice・MCP共有 | 実装① サポートエージェント／実装④ Claude Code 設定 |
| 3 Claude Code | CLAUDE.md 階層・rules(paths)・スキル・CI(-p) | 実装④ Claude Code 設定 |
| 4 Prompt & 構造化出力 | few-shot・スキーマの限界・バッチ・別インスタンスでレビュー | 実装③ 構造化データ抽出 |
| 5 Context & Reliability | 事実の抜き出し・人への引き継ぎ・スクラッチパッド・層化抽出 | 実装① サポートエージェント／実装③ 抽出 |

## ほぼ常に『外れ』（迷ったら消す）

- 強調する／もっと慎重に、と指示を強める
- 大きなモデル・大きなコンテキストに変える
- 確信度を自己申告させてふるい分ける
- 感情分析で難しさを測る
- 別の分類器・振り分け層を足す（過剰）
- 空の結果を成功として返す／1つの失敗で全体を止める
- 複数回実行して多数決（本物のバグを落とす）

> 使い方：模試で8割に届かない分野があったら、上の表の「戻る場所」を1つやり直す。弱点を**分野単位**で潰すのが、合格への最短です。
"""


# ===========================================================================
# (3) English rapid review（実装の英語版・本番の言い回しに慣れる）
# ===========================================================================
EN = [
    {"type": "single_choice", "q": "An agent's loop sometimes stops early because it ends whenever the response contains any text. What is the correct fix?",
     "opts": s(1,
        "Cap the loop at 10 iterations and stop there.",
        'Continue while stop_reason is "tool_use" and stop on "end_turn".',
        'Tell the model to write "DONE" and stop on that string.',
        "Stop after two consecutive text blocks."),
     "exp": "Loop control is driven by stop_reason. Text can accompany tool_use, so it is not a completion signal. [1.1]"},
    {"type": "single_choice", "q": "Refunds over $500 must always get human approval, but the system-prompt rule is occasionally not followed. Best fix?",
     "opts": s(1,
        "Put the rule in capital letters at the top of the prompt.",
        "Add a hook that blocks refunds over $500 and routes them to escalation.",
        "Add five few-shot examples of the rule being followed.",
        "Ask the agent to self-check after each refund."),
     "exp": "Rules that must hold for money are enforced in code (a hook/gate). Prompt-only compliance is probabilistic. [1.4]"},
    {"type": "single_choice", "q": 'A tool returns only "Operation failed", and the agent keeps retrying a disallowed action. Best fix?',
     "opts": s(0,
        "Return a structured error with errorCategory, isRetryable, and a human-readable message.",
        "Cap retries at two in the system prompt.",
        "Raise an exception that ends the agent.",
        "Return an empty success so the agent moves on."),
     "exp": "Structured errors let the agent decide whether to retry and what to tell the user. [2.2]"},
    {"type": "multiple_choice", "q": "Two trusted sources report different market-size figures (a 2024 study and a 2026 study). What should the synthesis do? (Select TWO.)",
     "opts": mm({0, 1},
        "Keep both figures, each with its source and published date.",
        "Note it as a conflict that may reflect change over time.",
        "Keep only the newer figure.",
        "Report the average of the two.",
        "Drop the field because the sources disagree."),
     "exp": "Conflicting figures are kept with provenance; the difference may be change over time, not an error. [5.6]"},
    {"type": "single_choice", "q": "In a multi-agent research pipeline, how does the coordinator run researchers in parallel?",
     "opts": s(2,
        "Use fork_session to branch into several sessions.",
        "Send the requests to the Message Batches API.",
        "Emit multiple Task calls in a single response.",
        "Send the same prompt several times and keep the fastest."),
     "exp": "Parallelism = multiple Task calls in one response. [1.3]"},
    {"type": "single_choice", "q": "A coordinator never delegates and tries to do all research itself; the subagent definitions are correct. Most likely cause?",
     "opts": s(1,
        "The subagents' prompts are too short.",
        'The coordinator\'s allowedTools does not include "Task".',
        "The context window is too small.",
        'tool_choice is set to "auto".'),
     "exp": "Delegation uses the Task tool; it must be in allowedTools. [1.2]"},
    {"type": "single_choice", "q": "An extraction model invents a plausible PO number when the document has none. The schema marks po_number required. Best fix?",
     "opts": s(0,
        "Make po_number optional (nullable) so it can return null.",
        'Add "do not fabricate" to the prompt.',
        "Verify the PO number with a second model.",
        "Drop documents without a PO number."),
     "exp": "A required field forces the model to fill something. nullable lets it return null instead of fabricating. [4.3]"},
    {"type": "single_choice", "q": "A document is missing a required field. Retrying with the validation error attached will...",
     "opts": s(1,
        "fix it, because retries always converge.",
        "not fix it — retries help format/structure errors, not information that is absent.",
        "fix it only with a larger model.",
        "fix it if you raise the retry limit."),
     "exp": "Retries fix format/structure. Missing information cannot be retried into existence; route to human. [4.4]"},
    {"type": "single_choice", "q": "A new kind of document does not fit the six-value document_category enum, and downstream reports break. Best schema change?",
     "opts": s(2,
        "Remove the enum and allow free text.",
        "Make document_category optional so it can be empty.",
        'Add an "other" value plus a detail field describing the category.',
        "Add fifty more enum values."),
     "exp": 'Add "other" + detail so new kinds are captured without breaking aggregation. [4.3]'},
    {"type": "single_choice", "q": "tool_use with a strict JSON schema guarantees which of the following?",
     "opts": s(1,
        "That line items always sum to the total.",
        "Only valid output structure (syntax) — not semantic correctness.",
        "That numbers are always correct.",
        "That required data is always present in the document."),
     "exp": "Schemas prevent syntax errors only. Semantic checks (e.g., sum vs total) must be added separately. [4.4]"},
    {"type": "single_choice", "q": "You want a shared /review command available to everyone who clones the repository. Where does it go?",
     "opts": s(0,
        "In the repository's .claude/commands/.",
        "In ~/.claude/commands/.",
        "Written into the project CLAUDE.md.",
        "Registered in config.json."),
     "exp": ".claude/commands/ is version-controlled and shared. Home-dir commands are personal. [3.1]"},
    {"type": "single_choice", "q": "Coding standards differ by area, and the relevant files are scattered across the codebase. How should the standards be applied?",
     "opts": s(0,
        "Put rules in .claude/rules/ with glob patterns in paths so they auto-apply by path.",
        "Put everything in the root CLAUDE.md.",
        "Make a skill and invoke it manually.",
        "Place a CLAUDE.md in every directory."),
     "exp": "paths globs apply the right rules only when matching files are edited. [3.3]"},
    {"type": "single_choice", "q": "A skill floods the main conversation with output and exhausts the context. Which frontmatter setting helps?",
     "opts": s(0, "context: fork", "allowed-tools", "argument-hint", "paths"),
     "exp": "context: fork runs the skill in an isolated subagent context, keeping its output out of the main conversation. [3.2]"},
    {"type": "single_choice", "q": "You must share one MCP server with the whole team without committing the auth token. Best setup?",
     "opts": s(0,
        "Define it in .mcp.json and pass the token via ${GITHUB_TOKEN}.",
        "Put the token directly in .mcp.json.",
        "Define it in ~/.claude.json.",
        "Add .mcp.json to .gitignore."),
     "exp": ".mcp.json is shared; environment-variable expansion keeps the secret out of the repo. [2.4]"},
    {"type": "single_choice", "q": "You are refactoring a monolith into microservices across dozens of files, with boundary decisions required. Best workflow?",
     "opts": s(0,
        "Use plan mode to investigate and design, then direct execution to implement.",
        "Start with direct execution and fix issues as they appear.",
        "Change all files in a single prompt.",
        "Stay in plan mode through the code changes too."),
     "exp": "Large, design-heavy changes start in plan mode; the complexity is known up front. [3.4]"},
    {"type": "multiple_choice", "q": "You plan to reduce human review of extractions. Which TWO practices should you adopt? (Select TWO.)",
     "opts": mm({0, 1},
        "Calibrate field-level confidence scores with a labeled validation set.",
        "Keep reviewing a stratified random sample of high-confidence extractions.",
        "Trust every extraction scoring 0.9+ from day one.",
        "Review only the documents customers complain about.",
        "Use overall accuracy as the sole criterion."),
     "exp": "Calibrate confidence against labels, and keep stratified sampling to catch hidden weak spots. [5.5]"},
]


def main():
    assert len(EN) == 16
    # ---- (1) 合格ロードマップ ----
    print("=== (1) 合格ロードマップ ===")
    path = b.sb(env, "POST", "learning_paths", {
        "title": "CCAR-F 合格ロードマップ（全体）",
        "description": "試験ガイドの推奨順に沿った、合格までの全体ロードマップ。まず模擬で現在地を測り、"
                       "実装で手を動かし、直前対策で仕上げて、本番に臨みます。各ステップに目標日つき。",
        "status": "published", "sort_order": 2})[0]
    pid = path["id"]
    print(f"  path: {pid}")
    items = [
        (C_MOCK,   0,  7, "まず現在地：模擬問題集・第1弾（第2弾/9章は仕上げで再訪）"),
        (C_MASTER, 1, 28, "手を動かす：実装マスター（課題1〜4）＝ガイドが飛ばすなと言う段階"),
        (C_PREP,   2, 35, "仕上げ：直前対策（暗記・見分け方・最難関15問）＋模擬の本番形式"),
    ]
    for cid, order, days, label in items:
        b.sb(env, "POST", "path_items", {"path_id": pid, "course_id": cid, "sort_order": order,
             "target_days": days, "milestone_label": label})
        print(f"    item[{order}] +{days}日  {label}")
    for uid in MEMBERS:
        b.sb(env, "POST", "path_enrollments", {"user_id": uid, "path_id": pid, "status": "active"})
    print(f"  path受講登録: {len(MEMBERS)}名")

    # ---- (2) 弱点マップ レッスン（直前対策コースに追加）----
    print("=== (2) 弱点マップ レッスン ===")
    lesson(PREP_SEC2, "弱点マップ：間違えたら、どこに戻るか", WEAK, 4)

    # ---- (3) English rapid review（総合コースに総仕上げ章）----
    print("=== (3) English rapid review（総合コース）===")
    sec = b.sb(env, "POST", "sections", {"course_id": C_MASTER,
               "title": "総仕上げ ｜ English rapid review", "sort_order": 5})[0]["id"]
    quiz(sec, "English rapid review 16問", "本番は英語。4課題の要点を英語の言い回しで総点検する。解説は日本語。",
         0, EN, passing=80, minutes=32)

    print("完成 🎓")


if __name__ == "__main__":
    main()
