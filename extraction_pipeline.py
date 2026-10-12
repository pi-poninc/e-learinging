"""CCAR-F 練習課題3: 構造化データ抽出のパイプライン

試験ガイド8章 Exercise 3 を Claude Agent SDK (Python) で実装した学習用サンプル。
対応する出題項目をコメントに [4.3] のように書いてある。

やること（ガイド8章・課題3）:
- 必須と任意、列挙値と other、nullable を含むスキーマで抽出ツールを定義する [4.3]
- 検証エラーを添えた再試行ループを作る [4.4]
- 形式の違う文書の例を few-shot で足す [4.2]
- 100件をバッチで流し、失敗分だけ再提出する [4.5]
- 確信度で人のレビューに回す仕組みを作る [5.5]

実行:
    pip install claude-agent-sdk
    export ANTHROPIC_API_KEY=...
    python extraction_pipeline.py        # バッチ処理のデモ（モデル不要・決定的）
"""

import asyncio
import json
import re
import sys
from typing import Any

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
    create_sdk_mcp_server,
    tool,
)

CATEGORIES = ["invoice", "receipt", "contract", "quote", "statement", "credit_note"]
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_MISSING = object()

# ---------------------------------------------------------------------------
# スキーマ: 必須/任意・列挙+other・nullable を1か所にまとめる [4.3]
# ---------------------------------------------------------------------------
SCHEMA: dict[str, dict] = {
    "invoice_id":      {"type": "str",    "required": True},
    "total":           {"type": "number", "required": True},
    "issued_date":     {"type": "date",   "required": True},   # ISO 8601 (YYYY-MM-DD)
    "po_number":       {"type": "str",    "required": False, "nullable": True},  # 無ければ null（捏造しない）[4.3]
    "category":        {"type": "enum",   "required": True, "values": CATEGORIES, "other": True},
    "category_detail": {"type": "str",    "required": False, "nullable": True},
    "confidence":      {"type": "number", "required": True},
}


def validate(rec: dict) -> list[str]:
    """スキーマ違反を文字列のリストで返す。防げるのは“形式”の誤り。意味の誤りは別途 [4.4]。"""
    errors: list[str] = []
    for field, spec in SCHEMA.items():
        val = rec.get(field, _MISSING)
        if val is _MISSING or val is None:
            # None は nullable なら許す。欠落は required なら NG
            if val is None and spec.get("nullable"):
                continue
            if spec["required"]:
                errors.append(f"{field}: required")
            continue
        t = spec["type"]
        if t == "str" and not isinstance(val, str):
            errors.append(f"{field}: must be a string")
        elif t == "number" and (isinstance(val, bool) or not isinstance(val, (int, float))):
            errors.append(f"{field}: must be a number")
        elif t == "date" and not ISO_DATE.match(str(val)):
            errors.append(f"{field}: must be ISO 8601 (YYYY-MM-DD)")
        elif t == "enum":
            allowed = spec["values"] + (["other"] if spec.get("other") else [])
            if val not in allowed:
                errors.append(f"{field}: must be one of {allowed}")
    if rec.get("category") == "other" and not rec.get("category_detail"):
        errors.append("category_detail: required when category is 'other'")
    return errors


# ---------------------------------------------------------------------------
# モデルの代役（決定的）。raw な文書から record を作る。
# feedback（前回の検証エラー）があれば“形式”の誤りだけ直す [4.4]
# ---------------------------------------------------------------------------
def extract(raw: dict, feedback: list[str] | None = None) -> dict:
    rec: dict[str, Any] = {}
    rec["invoice_id"] = raw.get("invoice_id")

    total = raw.get("total")
    if isinstance(total, str):
        # "¥1,200.00" のような文字列。1回目はそのまま（検証エラー）、再試行で数値化 [4.4]
        rec["total"] = float(re.sub(r"[^\d.]", "", total)) if feedback else total
    else:
        rec["total"] = total

    d = raw.get("issued_date")
    if isinstance(d, str) and "/" in d:
        # "2026/03/04" → 再試行で "2026-03-04"
        rec["issued_date"] = d.replace("/", "-") if feedback else d
    else:
        rec["issued_date"] = d

    # 発注番号: 文書になければ null。もっともらしい番号を捏造しない [4.3]
    rec["po_number"] = raw.get("po_number")

    # 分類: 既知の列挙値ならそのまま。未知なら other ＋ 内容を detail に [4.3]
    cat = raw.get("category")
    if cat in CATEGORIES:
        rec["category"], rec["category_detail"] = cat, None
    elif cat:
        rec["category"], rec["category_detail"] = "other", cat
    else:
        rec["category"], rec["category_detail"] = None, None

    rec["confidence"] = raw.get("confidence", 0.9)
    return rec


def extract_with_retry(raw: dict, max_retries: int = 2) -> dict:
    """検証→エラーなら、そのエラーを添えて再試行するループ [4.4]。
    形式の誤りは直るが、情報がそもそも無いもの（必須欠落）は再試行では直らない。"""
    feedback: list[str] | None = None
    errors: list[str] = []
    for attempt in range(max_retries + 1):
        rec = extract(raw, feedback)
        errors = validate(rec)
        if not errors:
            return {"ok": True, "record": rec, "attempts": attempt + 1}
        feedback = errors
    return {"ok": False, "errors": errors, "attempts": max_retries + 1}


def route_for_review(rec: dict, threshold: float = 0.8) -> list[str]:
    """人のレビューに回す理由を返す（空なら自動確定）[5.5]。
    確信度が低い、または other（新種の文書）は人が見る。"""
    reasons = []
    if rec.get("confidence", 0) < threshold:
        reasons.append("low_confidence")
    if rec.get("category") == "other":
        reasons.append("category_other")
    return reasons


# ---------------------------------------------------------------------------
# バッチ処理。失敗分だけ再提出できるよう custom_id で管理する [4.5]
# ---------------------------------------------------------------------------
MAX_DOC_CHARS = 2000  # コンテキスト上限の模擬


def run_batch(docs: dict[str, dict]) -> dict:
    """docs は {custom_id: raw}。大きすぎる文書は失敗扱い（上限超の模擬）[4.5]。"""
    results: dict[str, dict] = {}
    failed: list[str] = []
    for cid, raw in docs.items():
        if len(json.dumps(raw, ensure_ascii=False)) > MAX_DOC_CHARS:
            results[cid] = {"status": "failed", "errorCategory": "too_large"}
            failed.append(cid)
            continue
        out = extract_with_retry(raw)
        if out["ok"]:
            results[cid] = {"status": "ok", "record": out["record"],
                            "review": route_for_review(out["record"])}
        else:
            results[cid] = {"status": "failed", "errorCategory": "validation", "errors": out["errors"]}
            failed.append(cid)
    return {"results": results, "failed": failed}


def resubmit_failures(docs: dict[str, dict], failed_ids: list[str]) -> dict:
    """失敗した custom_id だけを再提出する。全件やり直さない [4.5]。"""
    return run_batch({cid: docs[cid] for cid in failed_ids if cid in docs})


# ---------------------------------------------------------------------------
# 抽出ツール（エージェントから使う）。構造化エラーで返す [4.4]
# ---------------------------------------------------------------------------
def ok(payload: dict) -> dict:
    return {"content": [{"type": "text", "text": json.dumps(payload, ensure_ascii=False)}]}


def err(category: str, retryable: bool, message: str) -> dict:
    payload = {"errorCategory": category, "isRetryable": retryable, "message": message}
    return {"content": [{"type": "text", "text": json.dumps(payload, ensure_ascii=False)}],
            "is_error": True}


@tool(
    "extract_invoice",
    "Extract structured fields from ONE invoice-like document and validate them against the "
    "schema (invoice_id, total, issued_date in ISO 8601, optional po_number, category as an "
    "enum or 'other', confidence). If a required value is not present in the document, leave "
    "it null — never invent it. Returns the validated record, or a structured error if it "
    "cannot be made valid.",
    {"document": dict},
)
async def extract_invoice(args: dict[str, Any]) -> dict[str, Any]:
    out = extract_with_retry(args["document"])
    if out["ok"]:
        return ok({"record": out["record"], "review": route_for_review(out["record"])})
    # 形式の誤りは再試行で直る。直らない＝情報が文書にない等なので、人のレビューへ [4.4]
    return err("validation", False,
               "Could not produce a valid record; missing data cannot be fabricated. "
               f"Errors: {out['errors']}. Route to human review.")


server = create_sdk_mcp_server(name="extraction", version="1.0.0", tools=[extract_invoice])
P = "mcp__extraction__"


# few-shot で、形式の違う文書の例を見せる [4.2]
SYSTEM_PROMPT = """You extract structured data from invoice-like documents using extract_invoice.

Rules:
- If a required value is not present in the document, leave it null. Never invent a value.
- Dates must be ISO 8601 (YYYY-MM-DD). Totals must be numbers, not strings.
- Unknown document kinds use category "other" with a category_detail describing it.

Examples (format varies; normalize it):
- total "¥1,200.00" -> 1200.0
- issued_date "2026/03/04" -> "2026-03-04"
- a document with no PO number -> po_number: null (do not guess)
- a "delivery note" (not in the enum) -> category "other", category_detail "delivery note"
"""

OPTIONS = ClaudeAgentOptions(
    system_prompt=SYSTEM_PROMPT,
    mcp_servers={"extraction": server},
    tools=[],
    allowed_tools=[f"{P}extract_invoice"],
    setting_sources=[],
    max_turns=8,
)


DEMO_DOCS = {
    "doc-1": {"invoice_id": "INV-001", "total": "¥1,200.00", "issued_date": "2026/03/04",
              "category": "invoice", "confidence": 0.95},        # 形式ゆれ→再試行で整う
    "doc-2": {"invoice_id": "INV-002", "total": 4200.0, "issued_date": "2026-03-10",
              "category": "delivery note", "confidence": 0.9},   # 未知分類→other、レビュー行き
    "doc-3": {"invoice_id": "INV-003", "total": 980.0, "issued_date": "2026-03-11",
              "category": "receipt", "confidence": 0.6},         # 低確信度→レビュー行き
    "doc-4": {"total": 500.0, "issued_date": "2026-03-12",
              "category": "invoice", "confidence": 0.9},         # invoice_id 欠落→再試行でも直らず失敗
}


async def run_agent(prompt_doc: dict) -> None:
    print(f"\n=== DOC: {json.dumps(prompt_doc, ensure_ascii=False)}")
    async with ClaudeSDKClient(options=OPTIONS) as client:
        await client.query("Extract this document: " + json.dumps(prompt_doc, ensure_ascii=False))
        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, ToolUseBlock):
                        print(f"  [tool] {block.name} {json.dumps(block.input, ensure_ascii=False)}")
                    elif isinstance(block, TextBlock) and block.text.strip():
                        print(f"  AGENT: {block.text.strip()}")
            elif isinstance(message, ResultMessage):
                print(f"  (stop_reason={message.stop_reason}, turns={message.num_turns})")


def main() -> None:
    # モデル不要のバッチ処理デモ（決定的）
    print("=== バッチ処理（100件相当の縮小版）===")
    out = run_batch(DEMO_DOCS)
    print(json.dumps(out, ensure_ascii=False, indent=2))
    print("\n=== 失敗分だけ再提出 ===")
    print("failed:", out["failed"])
    print(json.dumps(resubmit_failures(DEMO_DOCS, out["failed"]), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "agent":
        asyncio.run(run_agent(DEMO_DOCS["doc-1"]))
    else:
        main()
