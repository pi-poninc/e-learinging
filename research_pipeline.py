"""CCAR-F 練習課題4: マルチエージェントの調査パイプライン

試験ガイド8章 Exercise 4 を Claude Agent SDK (Python) で実装した学習用サンプル。
対応する出題項目をコメントに [1.2] のように書いてある。

やること（ガイド8章・課題4）:
- 2つ以上のサブエージェントに委任するコーディネーターを作る [1.2]
- 1回の応答で複数の Task を出して並列化する [1.3]
- 主張・根拠・出典・公開日を分けた構造化出力にする [2.2]
- タイムアウトを模擬してエラー伝播を確かめる [2.2][5.3]
- 食い違う情報源を両方残せるか確かめる [5.6]

実行:
    pip install claude-agent-sdk
    export ANTHROPIC_API_KEY=...
    python research_pipeline.py          # 用意した調査依頼を実行
    python research_pipeline.py "自由な調査依頼"
"""

import asyncio
import json
import sys
from typing import Any

from claude_agent_sdk import (
    AgentDefinition,
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
    create_sdk_mcp_server,
    tool,
)

# ---------------------------------------------------------------------------
# ダミーの検索バックエンド
# 各 finding は 主張 / 根拠 / 出典 / 公開日 を分けた構造化データ [2.2]
# "market_size" はわざと食い違う2件を入れてある（2024年調査 vs 2026年調査）[5.6]
# ---------------------------------------------------------------------------
SEARCH_DB: dict[str, list[dict]] = {
    "ev market size": [
        {"topic": "market_size", "claim": "世界のEV市場規模は約5,000億ドル",
         "evidence": "2024年の業界レポートの推計", "source": "https://research-a.example/ev-2024",
         "published": "2024-05"},
        {"topic": "market_size", "claim": "世界のEV市場規模は約8,200億ドル",
         "evidence": "2026年の最新調査の推計", "source": "https://research-b.example/ev-2026",
         "published": "2026-03"},
    ],
    "ev adoption trend": [
        {"topic": "adoption", "claim": "新車販売に占めるEV比率は18%",
         "evidence": "2026年の販売統計", "source": "https://stats-c.example/ev-share",
         "published": "2026-02"},
    ],
    "ev charging infrastructure": [
        {"topic": "charging", "claim": "公共充電ポートは前年比32%増",
         "evidence": "充電網の年次報告", "source": "https://grid-d.example/charging",
         "published": "2026-01"},
    ],
}

# セッション内の状態。本番ではセッションIDごとに持つ
STATE: dict[str, Any] = {"flaky_calls": 0}


def ok(payload: dict) -> dict:
    return {"content": [{"type": "text", "text": json.dumps(payload, ensure_ascii=False)}]}


def err(category: str, retryable: bool, message: str) -> dict:
    """構造化エラー [2.2]。空の結果と混同させないため、失敗は種類と再試行可否つきで返す。"""
    payload = {"errorCategory": category, "isRetryable": retryable, "message": message}
    return {
        "content": [{"type": "text", "text": json.dumps(payload, ensure_ascii=False)}],
        "is_error": True,
    }


def search_backend(query: str) -> list[dict]:
    """クエリに含まれる語がすべて一致する最初のトピックの findings を返す（決定的）。"""
    q = query.strip().lower()
    for key, findings in SEARCH_DB.items():
        if all(word in q for word in key.split()):
            return findings
    return []


# ---------------------------------------------------------------------------
# ツール。サブエージェントが使う検索ツール。説明文で「1つのサブトピックだけ渡す」ことを明示 [2.1]
# ---------------------------------------------------------------------------
@tool(
    "web_search",
    "Search the web for ONE focused subtopic. Returns a list of findings; each finding has "
    "topic, claim, evidence, source (URL), and published date. Pass a single subtopic, NOT a "
    "broad multi-part question. If the service is temporarily unavailable it returns a "
    "retryable error; zero matches is a normal result, not an error.",
    {"query": str},
)
async def web_search(args: dict[str, Any]) -> dict[str, Any]:
    query = args["query"].strip()
    if "charging" in query.lower():
        # 一時的な障害のシミュレーション。1回目だけタイムアウトする [2.2]
        STATE["flaky_calls"] += 1
        if STATE["flaky_calls"] == 1:
            return err("transient", True, "Search service timed out. Retrying is safe.")
    findings = search_backend(query)
    if not findings:
        # 「該当なし」は正常な結果。アクセス失敗（is_error）とは区別する [5.3]
        return ok({"found": 0, "findings": []})
    return ok({"found": len(findings), "findings": findings})


server = create_sdk_mcp_server(name="research", version="1.0.0", tools=[web_search])
P = "mcp__research__"


# ---------------------------------------------------------------------------
# 統合ロジック（モデルを介さず単体テストできる純関数）
# ---------------------------------------------------------------------------
def merge_findings(groups: list[list[dict]]) -> list[dict]:
    """複数サブエージェントの findings を1つに統合する。
    - 主張と出典が同じものは重複排除する
    - 出典（claim→source）の対応は保持する。要約でつぶさない [2.2]
    - 値が食い違う finding は、片方を捨てず両方残す（出典が違えば別物）[5.6]
    """
    merged: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for group in groups:
        for f in group:
            key = (f.get("claim", ""), f.get("source", ""))
            if key in seen:
                continue
            seen.add(key)
            merged.append(f)
    return merged


def detect_conflicts(findings: list[dict]) -> list[str]:
    """同じ topic に、異なる主張が2つ以上あるものを「食い違い」として返す [5.6]。"""
    by_topic: dict[str, set[str]] = {}
    for f in findings:
        by_topic.setdefault(f.get("topic", ""), set()).add(f.get("claim", ""))
    return sorted(t for t, claims in by_topic.items() if len(claims) > 1)


def assemble_report(groups: list[list[dict]], failed_subtopics: list[str]) -> dict:
    """統合結果 ＋ 食い違い ＋ 取得できなかったサブトピック（穴）をまとめる。
    使えなかった情報源を黙って落とさず、coverage_gaps として明示する [5.6]。
    """
    merged = merge_findings(groups)
    return {
        "findings": merged,
        "conflicts": detect_conflicts(merged),
        "coverage_gaps": list(failed_subtopics),
    }


# ---------------------------------------------------------------------------
# サブエージェント。AgentDefinition = 説明・システムプロンプト・使えるツールの制限
# コーディネーターは Task ツールでこれらに委任する [1.2]
# ---------------------------------------------------------------------------
RESEARCHER = AgentDefinition(
    description="Researches ONE focused subtopic using web_search and returns structured "
                "findings (claim, evidence, source, published). Use one researcher per subtopic.",
    prompt=(
        "You research a single subtopic. Call web_search with one focused query. "
        "Return every finding with its claim, evidence, source URL, and published date kept "
        "separate — never merge a claim with its source or drop the source. "
        "If web_search returns a retryable error, retry once; if it still fails, report a "
        "structured error (do not return an empty result as if nothing was found). "
        "Zero matches is a valid empty result, reported as such."
    ),
    tools=[f"{P}web_search"],
    model="sonnet",
)

SYNTHESIZER = AgentDefinition(
    description="Combines findings from the researchers into one report, preserving every "
                "source and keeping conflicting figures from different sources.",
    prompt=(
        "You synthesize the researchers' findings into one report. "
        "Keep each claim attached to its source and published date. "
        "When two sources give conflicting figures for the same topic, KEEP BOTH, each with "
        "its source and date — do not pick one or average them; the difference may reflect a "
        "change over time. "
        "If a subtopic could not be researched, state it as a coverage gap instead of hiding it."
    ),
    tools=[],
    model="sonnet",
)


# ---------------------------------------------------------------------------
# コーディネーター（エージェント）
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are the coordinator of a research pipeline.

For a research request:
1. Split it into distinct, non-overlapping subtopics (so researchers do not duplicate work).
2. Delegate EACH subtopic to a separate researcher subagent, launching them IN PARALLEL by
   emitting multiple Task calls in a single response.
3. When the researchers return, delegate to the synthesizer to produce one report.

In the final report:
- Keep every claim attached to its source and published date.
- If two sources give conflicting figures, present BOTH with their sources and dates.
- If a subtopic failed (e.g. the search kept timing out), note it as a coverage gap.
Do not invent sources, and do not drop a source when summarizing.
"""

OPTIONS = ClaudeAgentOptions(
    system_prompt=SYSTEM_PROMPT,
    mcp_servers={"research": server},
    agents={"researcher": RESEARCHER, "synthesizer": SYNTHESIZER},
    tools=[],  # 組み込みツールを外す
    allowed_tools=["Task", f"{P}web_search"],  # 委任(Task)と検索だけに絞る [2.3]
    setting_sources=[],  # 手元の CLAUDE.md や設定を読み込まない
    max_turns=20,
)

SCENARIOS = [
    "Research the EV market and give me one report: market size, adoption trend, and charging "
    "infrastructure. Flag any conflicting figures with their sources and dates.",
]


async def run(prompt: str) -> None:
    STATE.update(flaky_calls=0)
    print(f"\n=== USER: {prompt}")
    # SDK が stop_reason を見てループを回す。tool_use なら継続、end_turn で終了 [1.1]
    async with ClaudeSDKClient(options=OPTIONS) as client:
        await client.query(prompt)
        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, ToolUseBlock):
                        # Task（サブエージェント起動）も通常ツールもここに出る
                        print(f"  [tool] {block.name} {json.dumps(block.input, ensure_ascii=False)}")
                    elif isinstance(block, TextBlock) and block.text.strip():
                        print(f"  AGENT: {block.text.strip()}")
            elif isinstance(message, ResultMessage):
                print(f"  (stop_reason={message.stop_reason}, turns={message.num_turns})")


async def main() -> None:
    prompts = sys.argv[1:] or SCENARIOS
    for prompt in prompts:
        await run(prompt)


if __name__ == "__main__":
    asyncio.run(main())
