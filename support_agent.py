"""CCAR-F 練習課題1: エスカレーション付きの複数ツールエージェント

試験ガイド8章 Exercise 1 を Claude Agent SDK (Python) で実装した学習用サンプル。
対応する出題項目をコメントに [1.4] のように書いてある。

実行:
    pip install claude-agent-sdk
    export ANTHROPIC_API_KEY=...
    python support_agent.py            # 用意した4つのシナリオを順に実行
    python support_agent.py "自由な問い合わせ文"
"""

import asyncio
import json
import sys
from datetime import datetime, timezone
from typing import Any

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    HookMatcher,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
    create_sdk_mcp_server,
    tool,
)

REFUND_LIMIT_USD = 500

# ---------------------------------------------------------------------------
# ダミーのバックエンド
# ---------------------------------------------------------------------------
CUSTOMERS = {
    "C-1001": {"name": "Aiko Tanaka", "email": "aiko@example.com"},
    "C-1002": {"name": "Ken Sato", "email": "ken@example.com"},
    "C-1003": {"name": "Ken Sato", "email": "ken.sato@example.org"},  # 同姓同名
}
ORDERS = {
    # placed_at はわざと Unix タイムスタンプ。PostToolUse フックで ISO 8601 にそろえる [1.5]
    "O-501": {"customer_id": "C-1001", "total_usd": 120.0, "status": 3, "placed_at": 1789000000},
    "O-502": {"customer_id": "C-1001", "total_usd": 899.0, "status": 3, "placed_at": 1789500000},
    "O-503": {"customer_id": "C-1002", "total_usd": 45.0, "status": 1, "placed_at": 1790000000},
}

# セッション内の状態。本番ではセッションIDごとに持つ
STATE: dict[str, Any] = {"verified_customer_id": None, "flaky_calls": 0}


def ok(payload: dict) -> dict:
    return {"content": [{"type": "text", "text": json.dumps(payload, ensure_ascii=False)}]}


def err(category: str, retryable: bool, message: str) -> dict:
    """構造化エラー [2.2]。「Operation failed」だけ返すと、エージェントは回復を判断できない。"""
    payload = {"errorCategory": category, "isRetryable": retryable, "message": message}
    return {
        "content": [{"type": "text", "text": json.dumps(payload, ensure_ascii=False)}],
        "is_error": True,
    }


# ---------------------------------------------------------------------------
# ツール。説明文で「いつ使うか」「似たツールとの違い」を書き分ける [2.1]
# ---------------------------------------------------------------------------
@tool(
    "get_customer",
    "Identify and verify a CUSTOMER (a person). Use this FIRST in every conversation, "
    "before any order or refund operation. Input: a customer ID (format C-1234), an email "
    "address, or a full name. Returns the customer profile. If a name matches several "
    "customers, returns all candidates and you must ask the user for an email or customer "
    "ID instead of choosing one. Do NOT use this to look up an order; order IDs (format "
    "O-123) go to lookup_order.",
    {"identifier": str},
)
async def get_customer(args: dict[str, Any]) -> dict[str, Any]:
    ident = args["identifier"].strip()
    matches = [
        {"customer_id": cid, **c}
        for cid, c in CUSTOMERS.items()
        if ident in (cid, c["email"]) or ident.lower() == c["name"].lower()
    ]
    if not matches:
        # 「該当なし」は正常な結果。アクセス失敗とは区別する [2.2][5.3]
        return ok({"found": 0, "candidates": []})
    if len(matches) > 1:
        return ok({"found": len(matches), "verified": False, "candidates": matches})
    STATE["verified_customer_id"] = matches[0]["customer_id"]
    return ok({"found": 1, "verified": True, "customer": matches[0]})


@tool(
    "lookup_order",
    "Retrieve one ORDER by its order ID (format O-123): total, status, and order date. "
    "Use for questions about a specific order, delivery, or before a refund. Requires a "
    "verified customer (call get_customer first). Do NOT pass customer IDs, names, or "
    "emails here.",
    {"order_id": str},
)
async def lookup_order(args: dict[str, Any]) -> dict[str, Any]:
    order_id = args["order_id"].strip()
    if not order_id.startswith("O-"):
        return err("validation", False, "order_id must look like O-123.")
    if order_id == "O-503":
        # 一時的な障害のシミュレーション。1回目だけ失敗する
        STATE["flaky_calls"] += 1
        if STATE["flaky_calls"] == 1:
            return err("transient", True, "Order service timed out. Retrying is safe.")
    order = ORDERS.get(order_id)
    if order is None:
        return ok({"found": 0})
    if order["customer_id"] != STATE["verified_customer_id"]:
        return err("permission", False, "This order belongs to a different customer.")
    return ok({"found": 1, "order_id": order_id, **order})


@tool(
    "process_refund",
    "Issue a refund for one order. Use only after get_customer and lookup_order. "
    f"Refunds above ${REFUND_LIMIT_USD} are not allowed through this tool and must go to "
    "escalate_to_human.",
    {"order_id": str, "amount_usd": float, "reason": str},
)
async def process_refund(args: dict[str, Any]) -> dict[str, Any]:
    order = ORDERS.get(args["order_id"])
    if order is None:
        return err("validation", False, "Unknown order_id.")
    if args["amount_usd"] > order["total_usd"]:
        # 業務ルール違反。再試行不可と、顧客にそのまま伝えられる説明を返す [2.2]
        return err(
            "business",
            False,
            "The refund amount exceeds the order total. Tell the customer the maximum "
            f"refundable amount is ${order['total_usd']:.2f}.",
        )
    return ok({"refunded": True, "order_id": args["order_id"], "amount_usd": args["amount_usd"]})


@tool(
    "escalate_to_human",
    "Hand the case to a human agent. Use when: the customer explicitly asks for a human; "
    "the policy does not cover the request; a refund exceeds the limit; or you cannot make "
    "progress. The human CANNOT see this conversation, so every field must be complete.",
    {
        "type": "object",
        "properties": {
            "customer_id": {"type": "string", "description": "Verified ID, or 'unverified'"},
            "root_cause": {"type": "string"},
            "amount_usd": {"type": "number", "description": "Amount involved, 0 if none"},
            "recommended_action": {"type": "string"},
        },
        "required": ["customer_id", "root_cause", "recommended_action"],
    },
)
async def escalate_to_human(args: dict[str, Any]) -> dict[str, Any]:
    # 引き継ぎ先は会話を見られないので、構造化サマリーを渡す [1.4]
    return ok({"escalated": True, "ticket": "T-9001", "handoff": args})


server = create_sdk_mcp_server(
    name="support",
    version="1.0.0",
    tools=[get_customer, lookup_order, process_refund, escalate_to_human],
)
P = "mcp__support__"


# ---------------------------------------------------------------------------
# フック。確実に守らせたい規則はプロンプトではなくコードで強制する [1.4][1.5]
# ---------------------------------------------------------------------------
def deny(input_data: dict, reason: str) -> dict:
    return {
        "hookSpecificOutput": {
            "hookEventName": input_data["hook_event_name"],
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }


async def require_verified_customer(input_data, tool_use_id, context):
    """前提条件ゲート: get_customer が確認済みIDを返すまで、注文と返金をブロックする。"""
    if STATE["verified_customer_id"] is None:
        return deny(
            input_data,
            "Blocked: no verified customer yet. Call get_customer first and obtain a "
            "single verified customer ID.",
        )
    return {}


async def enforce_refund_limit(input_data, tool_use_id, context):
    """上限を超える返金をブロックし、人への引き継ぎに回す。"""
    amount = float(input_data["tool_input"].get("amount_usd", 0))
    if amount > REFUND_LIMIT_USD:
        return deny(
            input_data,
            f"Blocked by policy: refunds above ${REFUND_LIMIT_USD} need human approval. "
            "Do not retry. Call escalate_to_human with a complete handoff summary.",
        )
    return {}


STATUS_NAMES = {1: "processing", 2: "shipped", 3: "delivered"}


def normalize_order_text(text: str) -> str:
    """Unix タイムスタンプと数値ステータスを、読める形にそろえる。"""
    try:
        data = json.loads(text)
    except (TypeError, ValueError):
        return text
    if isinstance(data, dict):
        if isinstance(data.get("placed_at"), (int, float)):
            data["placed_at"] = datetime.fromtimestamp(
                data["placed_at"], tz=timezone.utc
            ).isoformat()
        if isinstance(data.get("status"), int):
            data["status"] = STATUS_NAMES.get(data["status"], "unknown")
    return json.dumps(data, ensure_ascii=False)


def _map_text(node: Any) -> Any:
    """ツール結果の形（文字列、content ブロックの配列、dict）を問わず text を変換する。"""
    if isinstance(node, str):
        return normalize_order_text(node)
    if isinstance(node, list):
        return [_map_text(n) for n in node]
    if isinstance(node, dict):
        return {k: (_map_text(v) if k in ("text", "content") else v) for k, v in node.items()}
    return node


async def normalize_order_output(input_data, tool_use_id, context):
    """PostToolUse: モデルが結果を見る前にデータ形式を統一する [1.5]。"""
    return {
        "hookSpecificOutput": {
            "hookEventName": input_data["hook_event_name"],
            "updatedToolOutput": _map_text(input_data.get("tool_response")),
        }
    }


# ---------------------------------------------------------------------------
# エージェント
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = f"""You are a customer support agent for an online store.

Escalation criteria (use escalate_to_human):
- The customer explicitly asks for a human: escalate immediately, without investigating first.
- The policy below does not cover the request.
- A refund above ${REFUND_LIMIT_USD}.
- You cannot make meaningful progress.
A frustrated tone alone is NOT a reason to escalate: acknowledge it and offer to resolve.

Policy: damaged or late items can be refunded up to the order total. Nothing else is covered.

If get_customer returns several candidates, ask for an email or customer ID. Never guess.
If a message contains several concerns, handle every one and give one combined answer.
If a tool error says isRetryable is true, retry once. If false, do not retry.

Examples:
- "My order O-1 arrived broken, refund please" -> verify, look up, refund, confirm.
- "I want to talk to a person" -> escalate_to_human right away.
- "Match your competitor's price" -> policy is silent -> escalate_to_human.
"""

OPTIONS = ClaudeAgentOptions(
    system_prompt=SYSTEM_PROMPT,
    mcp_servers={"support": server},
    tools=[],  # 組み込みツールを外し、役割に必要な4つだけにする [2.3]
    allowed_tools=[f"{P}*"],
    setting_sources=[],  # 手元の CLAUDE.md や設定を読み込まない
    max_turns=15,
    hooks={
        "PreToolUse": [
            HookMatcher(
                matcher=f"{P}lookup_order|{P}process_refund",
                hooks=[require_verified_customer],
            ),
            HookMatcher(matcher=f"{P}process_refund", hooks=[enforce_refund_limit]),
        ],
        "PostToolUse": [
            HookMatcher(matcher=f"{P}lookup_order", hooks=[normalize_order_output]),
        ],
    },
)

SCENARIOS = [
    "I'm Aiko (C-1001). Order O-501 arrived damaged, please refund the full amount.",
    "This is C-1001. Order O-502 arrived late. Refund all $899 now.",
    "My name is Ken Sato. Where is my order O-503?",
    "Customer C-1001 here. Three things: O-501 came damaged so refund it, tell me when "
    "O-502 was ordered, and can you match a competitor's price on my next order?",
]


async def run(prompt: str) -> None:
    STATE.update(verified_customer_id=None, flaky_calls=0)
    print(f"\n=== USER: {prompt}")
    # SDK が stop_reason を見てループを回す。tool_use なら継続、end_turn で終了 [1.1]
    async with ClaudeSDKClient(options=OPTIONS) as client:
        await client.query(prompt)
        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, ToolUseBlock):
                        print(f"  [tool] {block.name} {json.dumps(block.input)}")
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
