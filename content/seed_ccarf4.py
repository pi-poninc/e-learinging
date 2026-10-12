#!/usr/bin/env python3
"""CCAR-F 実装で理解する②（research_pipeline.py / test_research_offline.py の解説＋問題）。

セクション1「コード解説」: 全体像 / 検索ツールと構造化 / サブエージェントとコーディネーター /
  統合ロジック（食い違い・出典）/ オフラインテスト（lesson×5）
セクション2「理解度チェック」: コード読解クイズ17問 ＋ ハンズオン課題
＋ 管理者・南條・小中 を受講登録

出典: 試験ガイド8章 Exercise 4 を実装した research_pipeline.py / test_research_offline.py。
両オフラインテストは claude-agent-sdk を入れた環境で OK: 7 checks passed を確認済み。
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ADMIN_UUID = "bab3dae7-813b-43ee-b7f9-200ca779dcfd"
MEMBERS = [ADMIN_UUID,
           "8936dff0-704d-4d2f-bff0-c84869eec0fc",
           "fd11370b-58d9-4d8c-b95b-bdd851515f34"]
sys.path.insert(0, str(ROOT / "content"))
import build as b  # noqa: E402

env = b.load_env()


def lesson(section_id, title, body, order):
    le = b.sb(env, "POST", "lessons", {
        "section_id": section_id, "title": title, "body": body,
        "sort_order": order, "status": "published"})[0]
    print(f"  lesson[{order}] {title}  {le['id']}")
    return le["id"]


def assignment(section_id, title, desc, order):
    a = b.sb(env, "POST", "assignments", {
        "section_id": section_id, "title": title, "description": desc,
        "sort_order": order, "status": "published"})[0]
    print(f"  assignment[{order}] {title}  {a['id']}")
    return a["id"]


def quiz(section_id, title, desc, order, questions, passing=80, minutes=None):
    payload = {"section_id": section_id, "title": title, "description": desc,
               "passing_score": passing, "sort_order": order, "status": "published"}
    if minutes is not None:
        payload["time_limit_minutes"] = minutes
    q = b.sb(env, "POST", "quizzes", payload)[0]
    for qi, qq in enumerate(questions):
        qrow = b.sb(env, "POST", "quiz_questions", {
            "quiz_id": q["id"], "question_type": qq["type"],
            "question_text": qq["q"], "explanation": qq.get("exp", ""),
            "sort_order": qi, "points": 1})[0]
        for oi, (text, correct) in enumerate(qq["opts"]):
            b.sb(env, "POST", "quiz_options", {
                "question_id": qrow["id"], "option_text": text,
                "is_correct": correct, "sort_order": oi})
    print(f"  quiz[{order}] {title}  {q['id']}  ({len(questions)}問)")
    return q["id"]


def s(correct, *opts):
    return [(t, i == correct) for i, t in enumerate(opts)]


def m(cset, *opts):
    return [(t, i in cset) for i, t in enumerate(opts)]


def tfq(q, correct_bool, exp):
    return {"type": "true_false", "q": q, "exp": exp,
            "opts": [("○（正しい）", correct_bool), ("×（間違い）", not correct_bool)]}


# ===== レッスン本文 =====
L0 = r"""この2ファイルは、**CCAR-F 練習課題4「マルチエージェントの調査パイプライン」** を Claude Agent SDK（Python）で実装したものです。課題1（サポートエージェント）が“1体のエージェント”だったのに対し、こちらは**コーディネーターが複数のサブエージェントに委任する**のが主役です。対応は分野1・2・5。

## このプログラムは何をするか

調査依頼（例「EV市場の規模・普及・充電インフラを1本のレポートに」）を受けて、

1. コーディネーターが依頼を**重ならないサブトピックに分割**する
2. 各サブトピックを**別々のリサーチャー（サブエージェント）に、並列で**委任する [1.3]
3. リサーチャーは検索し、**主張・根拠・出典・公開日を分けた構造化データ**で返す [2.2]
4. シンセサイザー（統合役）が**出典を保ったまま1本のレポート**にまとめる
5. **食い違う数値は両方残し**、取得できなかったサブトピックは**穴として明示**する [5.6]

## 2つのファイルの関係

| ファイル | 役割 |
|---|---|
| `research_pipeline.py` | 本体。検索ツール・サブエージェント2種・コーディネーター設定・統合ロジック |
| `test_research_offline.py` | APIキー（モデル）なしで、検索ツールと統合ロジックだけを検証（`OK: 7 checks passed`） |

## 登場する部品（research_pipeline.py）

- **検索バックエンド** `SEARCH_DB`: サブトピックごとの findings。`market_size` には**わざと食い違う2件**（2024年版 / 2026年版）を入れてある [5.6]
- **ツール** `web_search`: 1サブトピックを検索。`charging` は1回目だけタイムアウト（障害の模擬）
- **サブエージェント** `RESEARCHER`（1サブトピックを調べる）/ `SYNTHESIZER`（統合する）＝ `AgentDefinition`
- **コーディネーター** `OPTIONS`（`agents=` と `allowed_tools=["Task", ...]`）と `SYSTEM_PROMPT`
- **統合ロジック（純関数）** `merge_findings` / `detect_conflicts` / `assemble_report`

## 流れの図

```
調査依頼
  ↓ コーディネーター：サブトピックに分割
  ↓ 1回の応答で Task を複数（＝並列委任）[1.3]
 ┌─ researcher（市場規模）─ web_search ─→ 構造化 findings
 ├─ researcher（普及）─────  web_search ─→ 構造化 findings
 └─ researcher（充電）─────  web_search ─→（1回目 timeout → 再試行）[2.2]
  ↓ 集まった findings
  ↓ synthesizer：出典を保って統合・食い違いは両方残す [5.6]
最終レポート（出典つき・穴は明示）
```

次から、検索ツール → サブエージェント/コーディネーター → 統合ロジック → テスト の順に読みます。
"""

L1 = r"""リサーチャーが使う検索ツールと、その戻り値の“形”を読みます。**出力の構造が、このパイプラインの品質を決めます** [2.2]。

## finding の構造（主張・根拠・出典・公開日を分ける）

検索結果の1件は、こういう形です。

```python
{"topic": "market_size",
 "claim": "世界のEV市場規模は約8,200億ドル",   # 主張
 "evidence": "2026年の最新調査の推計",         # 根拠
 "source": "https://research-b.example/ev-2026", # 出典(URL)
 "published": "2026-03"}                        # 公開日
```

**主張と出典をくっつけず、分けて持つ**のがポイントです。こうしておくと、あとで統合しても「どの主張が、どの出典・いつのものか」を失いません [2.2]。`SEARCH_DB` の `market_size` には、値が食い違う2件（2024年版・2026年版）がわざと入っています [5.6]。

## web_search ツール

```python
@tool("web_search",
  "Search the web for ONE focused subtopic. Returns findings with topic, claim, evidence, "
  "source (URL), and published date. Pass a single subtopic, NOT a broad multi-part question...",
  {"query": str})
async def web_search(args):
    query = args["query"].strip()
    if "charging" in query.lower():            # 一時障害の模擬
        STATE["flaky_calls"] += 1
        if STATE["flaky_calls"] == 1:
            return err("transient", True, "Search service timed out. Retrying is safe.")
    findings = search_backend(query)
    if not findings:
        return ok({"found": 0, "findings": []})   # 該当なし＝正常 [5.3]
    return ok({"found": len(findings), "findings": findings})
```

読みどころは3つ：

- **説明文で「1サブトピックだけ渡せ」と明示** [2.1]。広い多段の質問を1回で投げさせない（＝分割はコーディネーターの仕事）。
- **`charging` は1回目だけ `transient`（再試行可）エラー**。タイムアウトからの回復＝エラー伝播を試すための仕掛け。
- **該当0件は `found=0` の正常な結果**。アクセス失敗（`is_error`）と区別する [5.3]。混同すると「情報が存在しない」と誤って結論づけてしまう。

`ok()` / `err()` は課題1と同じ。`err()` は `errorCategory` / `isRetryable` / `message` ＋ `is_error=True` の構造化エラーです [2.2]。

> まとめ：**出力は主張・根拠・出典・公開日に分ける [2.2]**、**検索は1サブトピック [2.1]**、**0件は正常・失敗は構造化 [5.3]**。
"""

L2 = r"""ここが課題4の核心です。**コーディネーターが、複数のサブエージェントに、並列で委任**します。

## サブエージェントの定義（AgentDefinition）

`AgentDefinition` は、サブエージェントの**説明・システムプロンプト・使えるツールの制限**をまとめたものです。

```python
RESEARCHER = AgentDefinition(
    description="Researches ONE focused subtopic using web_search ...",
    prompt="You research a single subtopic. Call web_search ... keep claim, evidence, source, "
           "published separate ... retry once on a retryable error ... zero matches is valid ...",
    tools=[f"{P}web_search"],   # このサブエージェントは web_search だけ使える
    model="sonnet",
)

SYNTHESIZER = AgentDefinition(
    description="Combines findings ... preserving every source and keeping conflicting figures",
    prompt="... keep each claim attached to its source and date. When two sources conflict, "
           "KEEP BOTH ... do not pick one or average them ... note coverage gaps ...",
    tools=[],   # 統合役は検索しない（役割外のツールを持たせない）
    model="sonnet",
)
```

- リサーチャーは `web_search` **だけ**、シンセサイザーは**ツールなし**。役割に必要な分だけに絞ると、誤用が減ります [2.3]。
- プロンプトに「出典を分けたまま返せ」「再試行は1回」「0件は0件として返せ」「食い違いは両方残せ」と、**判断の基準**を書きます。

## コーディネーター（Task で委任・並列化）

```python
OPTIONS = ClaudeAgentOptions(
    system_prompt=SYSTEM_PROMPT,
    mcp_servers={"research": server},
    agents={"researcher": RESEARCHER, "synthesizer": SYNTHESIZER},
    tools=[],
    allowed_tools=["Task", f"{P}web_search"],   # 委任(Task)と検索だけに絞る [2.3]
    setting_sources=[], max_turns=20,
)
```

- **`allowed_tools` に `"Task"` が要る**。コーディネーターはこの Task ツールでサブエージェントを起動します。これが無いと、委任できずに自分で全部やろうとします [1.2]。
- `agents={...}` に、起動できるサブエージェントを登録します。

SYSTEM_PROMPT の指示（抜粋）：

1. 依頼を**重ならないサブトピックに分割**（researcher 同士の重複を防ぐ）
2. **各サブトピックを別の researcher に、1回の応答で複数の Task を出して並列に**委任 [1.3]
3. そろったら synthesizer に委任して1本のレポートに
4. 最終レポートは**出典つき・食い違いは両方・穴は明示**

> まとめ：**AgentDefinition でサブエージェントを定義**、**allowed_tools に Task を入れて委任 [1.2]**、**1応答で複数 Task ＝並列 [1.3]**、**役割に必要なツールだけ [2.3]**。
"""

L3 = r"""委任で集めた findings を、1本に統合する部分です。ここは**モデルを介さない純関数**なので、決定的に書けて、単体テストできます。

## merge_findings — 重複排除・出典保持

```python
def merge_findings(groups):
    merged, seen = [], set()
    for group in groups:
        for f in group:
            key = (f.get("claim", ""), f.get("source", ""))  # 重複判定は「主張＋出典」
            if key in seen:
                continue
            seen.add(key)
            merged.append(f)
    return merged
```

- 重複の判定キーは **(claim, source)**。**同じ主張でも出典が違えば別物**として両方残します。
- だから `market_size` の2024年版・2026年版は**両方残る**（出典が違うため）[5.6]。出典を落とさないのが肝です。

## detect_conflicts — 食い違いを見つける

```python
def detect_conflicts(findings):
    by_topic = {}
    for f in findings:
        by_topic.setdefault(f.get("topic",""), set()).add(f.get("claim",""))
    return sorted(t for t, claims in by_topic.items() if len(claims) > 1)
```

**同じ topic に、異なる主張が2つ以上**あれば「食い違い」。`market_size` が返ります。食い違いは、**片方を選んだり平均したりせず**、出典と公開日つきで両方示します。時期差は「変化」かもしれないからです [5.6]。

## assemble_report — 穴を明示する

```python
def assemble_report(groups, failed_subtopics):
    merged = merge_findings(groups)
    return {"findings": merged,
            "conflicts": detect_conflicts(merged),
            "coverage_gaps": list(failed_subtopics)}  # 取れなかったサブトピックを明示
```

取得できなかったサブトピック（例：充電がタイムアウトで取れなかった）を、**黙って落とさず `coverage_gaps` に明示**します。情報源が1つ欠けたのに“それらしい完全なレポート”を出すのは誤りです [5.6]。

## なぜ純関数に切り出すのか

統合の「正しさ」は、モデルの気分で変わってはいけません。**決定的なロジックに切り出せば、モデル抜きで単体テスト**でき、品質を保証できます（次のレッスン）。

> まとめ：**出典違いは両方残す [5.6]**、**同topic異claimが食い違い**、**取れなかった分はcoverage_gapsに明示**。
"""

L4 = r"""`test_research_offline.py` は、**APIキー（モデル）なし**で、検索ツールと統合ロジックの**ロジックだけ**を検証します。`OK: 7 checks passed` が出れば土台は正しい（実際にSDKを入れて確認済み）。

## 呼び方

```python
import research_pipeline as r
res = await r.web_search.handler({"query": "EV market size"})   # ツールは .handler を await
merged = r.merge_findings([g1, g2])                             # 純関数は直接呼ぶ
def body(result): return json.loads(result["content"][0]["text"])
```

## 7つのチェックの意味

1. **構造化出力**: `web_search("EV market size")` は2件返り、各 finding が `topic/claim/evidence/source/published` を持つ [2.2]。
2. **エラー伝播と再試行**: `charging` は1回目 `transient / isRetryable=True`、2回目は `found==1`（成功）[2.2][5.3]。
3. **該当なし**: 未知クエリは `found==0` で `is_error` を**含まない**（正常）[5.3]。
4. **重複排除**: 同じ `(claim, source)` を2グループ渡しても、`merge_findings` は1件にまとめる。
5. **食い違いは両方**: `market_size` の2件は `merge_findings` で**両方残り**、`detect_conflicts` が `["market_size"]` を返す [5.6]。
6. **穴の明示**: `assemble_report(..., failed_subtopics=["charging"])` が `coverage_gaps=["charging"]`、`conflicts=["market_size"]`、findings 2件を返す [5.6]。
7. **構造化エラーの形**: タイムアウトは `errorCategory="transient"`, `isRetryable=True`。

## 動かす

```bash
pip install claude-agent-sdk
python test_research_offline.py       # → OK: 7 checks passed
export ANTHROPIC_API_KEY=...
python research_pipeline.py           # 調査依頼を実行（並列委任→統合の様子が出る）
```

実行時は、コーディネーターが **Task を複数出す**様子（並列委任）と、researcher の `web_search` 呼び出し、最後に `stop_reason` が出ます [1.1][1.3]。

> まとめ：**決定的な部分（ツール・統合）はモデル抜きで単体テスト**。7チェックが、構造化出力・エラー伝播・食い違い・穴の明示を保証している。
"""

# ===== 理解度チェック 17問 =====
QUIZ = [
    {"type": "single_choice", "q": "web_search が返す finding 1件の構造として正しいのは？",
     "opts": s(1,
        "claim（主張）だけの文字列",
        "topic・claim・evidence・source・published を分けて持つ辞書",
        "source(URL)だけ",
        "要約済みの1段落テキスト"),
     "exp": "主張・根拠・出典・公開日を分けて持つ [2.2]。分けておくと統合しても出典や日付を失わない。"},
    {"type": "single_choice", "q": 'web_search({"query": "EV charging infrastructure"}) を初めて呼ぶと？',
     "opts": s(1,
        "必ず成功して findings を返す",
        'errorCategory="transient", isRetryable=True のエラー（1回目だけタイムアウト）',
        "found=0 の正常な結果",
        "permission エラー"),
     "exp": "一時障害の模擬。flaky_calls==1 で失敗、2回目で成功。isRetryable=True なので1回再試行してよい [2.2]。"},
    {"type": "single_choice", "q": "SEARCH_DB にないクエリ（例: quantum teapots on mars）を渡すと？",
     "opts": s(1,
        "is_error=True のエラー",
        "found=0 の正常な結果（is_error は含まない）",
        "例外を投げる",
        "市場規模の結果を返す"),
     "exp": "「該当なし」は正常な結果。アクセス失敗（is_error）とは区別する [5.3]。混同すると「情報が存在しない」と誤結論する。"},
    {"type": "single_choice", "q": "このパイプラインで、サブエージェントを並列に実行する方法は？",
     "opts": s(2,
        "fork_session で3つに分岐する",
        "Message Batches API に3つまとめて送る",
        "コーディネーターが1回の応答の中で複数の Task を出す",
        "同じプロンプトを3回送って速いものを採用する"),
     "exp": "並列実行は、1回の応答で複数の Task 呼び出しを出すことで行う [1.3]。"},
    {"type": "single_choice", "q": "コーディネーターがサブエージェントに委任するために、allowed_tools に必ず含める必要があるのは？",
     "opts": s(0,
        '"Task"',
        '"Delegate"',
        '"Spawn"',
        '"Subagent"'),
     "exp": 'Task ツールがサブエージェント起動の仕組み。allowed_tools に "Task" が無いと委任できず、自分で全部やろうとする [1.2]。'},
    {"type": "single_choice", "q": "AgentDefinition の tools=[f\"{P}web_search\"] は何を意味する？",
     "opts": s(1,
        "そのサブエージェントが web_search を呼ぶのを禁止する",
        "そのサブエージェントが使えるツールを web_search だけに制限する",
        "web_search を2回呼ぶ",
        "web_search の説明文を書き換える"),
     "exp": "AgentDefinition はサブエージェントの説明・プロンプト・使えるツールの制限をまとめたもの。役割に必要な分だけに絞る [2.3]。"},
    {"type": "single_choice", "q": "2つのリサーチャーに同じトピックを調べさせると起きる問題と、その対策（SYSTEM_PROMPT）は？",
     "opts": s(1,
        "問題はない。重複は synthesizer が必ず消す",
        "結果が重複して抜けも残る。依頼を重ならないサブトピックに分けて別々に委任する",
        "並列できなくなるので順番に実行する",
        "全サブエージェントに全ツールを与える"),
     "exp": "重複と抜けが出る。distinct なサブトピックに分割して委任するのがコーディネーターの役割（過度な重複は C1 の論点）。"},
    {"type": "single_choice", "q": "market_size に2024年版と2026年版の2件がある。merge_findings の結果は？",
     "opts": s(2,
        "新しい2026年版だけ残る",
        "2つの平均値に置き換わる",
        "出典が違うので両方残る",
        "古い方だけ残る"),
     "exp": "重複判定は (claim, source)。出典が違えば別物として両方残す。食い違いは片方を捨てない [5.6]。"},
    {"type": "single_choice", "q": "detect_conflicts(findings) が返すものは？",
     "opts": s(1,
        "出典URLの一覧",
        "同じ topic に異なる主張が2つ以上あるトピック名の一覧（例: market_size）",
        "最も新しい finding",
        "重複した finding の数"),
     "exp": "同topicに異claimが複数＝食い違い。market_size が返る。両方を出典・日付つきで示す [5.6]。"},
    {"type": "single_choice", "q": "あるサブトピックが取得できなかったとき、assemble_report はどうする？",
     "opts": s(1,
        "それらしい完全なレポートを出す",
        "coverage_gaps にそのサブトピックを明示する（黙って落とさない）",
        "レポート全体を中止する",
        "モデルの一般知識で埋める"),
     "exp": "情報源が1つ欠けたことを隠さず明示する。裏付けのある部分と穴を区別する [5.6]（C11 と同じ考え方）。"},
    {"type": "single_choice", "q": "SYNTHESIZER のプロンプトで、食い違う数値に対して禁じられている対応は？",
     "opts": s(3,
        "両方を出典と公開日つきで残す",
        "それぞれの出典を明記する",
        "食い違いがあることを述べる",
        "片方を選ぶ、または2つの平均を取る"),
     "exp": "片方を選ぶ/平均するのは誤り。両方残す。時期差は「変化」かもしれない [5.6]。"},
    {"type": "single_choice", "q": "merge_findings が重複と判定するキーは？",
     "opts": s(1,
        "claim（主張）だけ",
        "(claim, source) の組",
        "topic だけ",
        "published（公開日）だけ"),
     "exp": "(主張, 出典)。同じ主張でも出典が違えば別物として残す。出典を保つための設計。"},
    {"type": "single_choice", "q": "コーディネーターの tools=[] と allowed_tools=[\"Task\", f\"{P}web_search\"] の意図は？",
     "opts": s(0,
        "組み込みツールを外し、委任(Task)と検索だけに絞る",
        "すべてのツールを許可する",
        "ツールを完全に無効化する",
        "web_search を禁止する"),
     "exp": "ツールが多いと選択の信頼性が下がる。役割に必要な分だけに絞る [2.3]。"},
    {"type": "single_choice", "q": "test_research_offline.py が .handler と純関数を直接呼ぶ理由は？",
     "opts": s(0,
        "APIキーとモデルなしで、ツールと統合ロジックを決定的に検証するため",
        "本番より実行が速いから",
        "SDK がオフラインを強制するから",
        "モデルの出力同士を比較するため"),
     "exp": "統合の正しさはモデルの気分で変わってはいけない。決定的なロジックはモデル抜きで単体テストできる。"},
    {"type": "single_choice", "q": "run() の receive_response ループで、SDK がツール実行の継続と終了を切り替える判断材料は？",
     "opts": s(2,
        "ターン数",
        "テキストが含まれているか",
        "stop_reason（tool_use なら継続、end_turn で終了）",
        "サブエージェントの数"),
     "exp": "ループ制御は stop_reason で判定する [1.1]。ToolUseBlock には Task（委任）も通常ツールも現れる。"},
    tfq("食い違う数値は、新しいほうの数値だけをレポートに残すのが正しい。", False,
        "×。片方を選ばず、両方を出典と公開日つきで残す。時期の違いは変化の可能性 [5.6]。"),
    tfq("finding で主張(claim)と出典(source)を分けて持つのは、要約や統合の段階で出典が失われないようにするためである。", True,
        "○。主張と出典をくっつけず分けて持つことで、統合しても「どの主張がどの出典か」を保てる [2.2]。"),
]

ASSIGN = r"""課題4のコードを「読める」から「書ける」へ進めるハンズオンです。`research_pipeline.py` と `test_research_offline.py` を手元にコピーして取り組んでください（`pip install claude-agent-sdk`。APIキーがなくても `test_research_offline.py` は動きます）。

## 必須課題（どれか1つ以上）

**A. サブトピックを1つ増やす**
`SEARCH_DB` に新トピック（例: `"ev battery price"`）を足し、構造化 finding（topic/claim/evidence/source/published）を入れる。可能なら、別トピックにも**食い違う2件**を入れて detect_conflicts で検出させる。

**B. 統合ロジックを1つ強化する**
例: `detect_conflicts` を拡張し、食い違いがある topic に「最新の出典はどれか（published が最大）」の注記を付けて返す関数を足す。あるいは、`assemble_report` に「出典の数」を集計するフィールドを足す。

**C. サブエージェントを1つ足す**
例: 統合前に finding の信頼度を評価する `REVIEWER`（AgentDefinition, tools=[]）を定義し、コーディネーターの `agents` と SYSTEM_PROMPT に組み込む。

## 検証（必須）

`test_research_offline.py` に、追加した機能のテストを**最低1つ**足して、`python test_research_offline.py` が
`OK: N checks passed`（N が増える）で通ることを確認する。
- ツールは `r.<tool>.handler({...})` を await で呼ぶ。
- 純関数は `r.merge_findings([...])` のように直接呼ぶ。
- `body(result)` で content の中の JSON を取り出す。

## 提出するもの

1. 追加・変更したコード（diff でも全文でも可）
2. `python test_research_offline.py` の実行結果（`OK: ... passed` の行）
3. **ひとことで**: あなたの追加は、試験項目のどれ（例 [1.3][2.2][5.6]）に対応するか

## 評価の観点

- 主張・根拠・出典・公開日を分けて持てているか [2.2]
- 食い違いを両方残し、取れない分を穴として明示できているか [5.6]
- 委任・並列・ツール制限の考え方に沿っているか [1.2][1.3][2.3]
- 追加機能に決定的なテストが付いているか
"""


def main():
    assert len(QUIZ) == 17
    c = b.sb(env, "POST", "courses", {
        "title": "CCAR-F 実装で理解する ② ｜ マルチエージェント調査パイプライン",
        "description": "練習課題4の実装（research_pipeline.py / test_research_offline.py）を読み解くコース。コーディネーターからサブエージェントへの委任・並列Task・主張/出典を分けた構造化出力・タイムアウトのエラー伝播・食い違う情報源を両方残す統合を、試験の出題項目に結びつけて理解します。コード解説レッスン5本＋理解度チェック17問＋ハンズオン課題。両オフラインテストはSDK導入環境で動作確認済み。",
        "status": "published", "is_sequential": False, "created_by": ADMIN_UUID})[0]
    print(f"講座作成: {c['id']}")

    sec1 = b.sb(env, "POST", "sections", {
        "course_id": c["id"], "title": "コード解説", "sort_order": 0})[0]["id"]
    print(f"section1: {sec1}")
    lesson(sec1, "① このプログラムの全体像", L0, 0)
    lesson(sec1, "② 検索ツールと構造化データ（web_search）", L1, 1)
    lesson(sec1, "③ サブエージェントとコーディネーター（委任と並列）", L2, 2)
    lesson(sec1, "④ 統合ロジック（食い違いと出典）", L3, 3)
    lesson(sec1, "⑤ test_research_offline.py を読む", L4, 4)

    sec2 = b.sb(env, "POST", "sections", {
        "course_id": c["id"], "title": "理解度チェック", "sort_order": 1})[0]["id"]
    print(f"section2: {sec2}")
    quiz(sec2, "コード読解クイズ 17問",
         "research_pipeline.py / test_research_offline.py の挙動を理解できたか確認する。解説付き。", 0, QUIZ, passing=80)
    assignment(sec2, "ハンズオン：サブトピック or 統合ロジック or サブエージェントを足してテストする", ASSIGN, 1)

    for uid in MEMBERS:
        b.sb(env, "POST", "enrollments", {"user_id": uid, "course_id": c["id"], "status": "active"})
    print(f"受講登録: {len(MEMBERS)}名")
    print(f"受講URL: /courses/{c['id']}")
    print("完成 🎓")


if __name__ == "__main__":
    main()
