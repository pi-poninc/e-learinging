"""API キーなしで動く確認。ツールとフックのロジックだけを直接呼ぶ。

    python test_offline.py
"""

import asyncio
import json

import support_agent as s


def body(result):
    return json.loads(result["content"][0]["text"])


async def main():
    pre = {"hook_event_name": "PreToolUse"}

    # 1. 前提条件ゲート: 本人確認の前は拒否、後は許可
    s.STATE.update(verified_customer_id=None, flaky_calls=0)
    out = await s.require_verified_customer({**pre, "tool_input": {}}, None, None)
    assert out["hookSpecificOutput"]["permissionDecision"] == "deny"
    r = await s.get_customer.handler({"identifier": "C-1001"})
    assert body(r)["verified"] is True
    assert await s.require_verified_customer({**pre, "tool_input": {}}, None, None) == {}

    # 2. 同姓同名は候補を返し、確認済みにしない
    s.STATE.update(verified_customer_id=None)
    r = await s.get_customer.handler({"identifier": "Ken Sato"})
    assert body(r)["found"] == 2 and s.STATE["verified_customer_id"] is None

    # 3. 該当なしは正常な結果（エラーではない）
    r = await s.get_customer.handler({"identifier": "nobody"})
    assert body(r)["found"] == 0 and "is_error" not in r

    # 4. 返金上限: 500 は許可、500.01 は拒否
    ok = await s.enforce_refund_limit({**pre, "tool_input": {"amount_usd": 500}}, None, None)
    ng = await s.enforce_refund_limit({**pre, "tool_input": {"amount_usd": 500.01}}, None, None)
    assert ok == {} and ng["hookSpecificOutput"]["permissionDecision"] == "deny"

    # 5. 構造化エラー: 一時的な失敗は再試行可、2回目は成功
    s.STATE.update(verified_customer_id="C-1002", flaky_calls=0)
    r = await s.lookup_order.handler({"order_id": "O-503"})
    assert r["is_error"] and body(r) == {
        "errorCategory": "transient",
        "isRetryable": True,
        "message": "Order service timed out. Retrying is safe.",
    }
    r = await s.lookup_order.handler({"order_id": "O-503"})
    assert body(r)["found"] == 1

    # 6. 検証、権限、業務の各エラーは再試行不可
    for args, cat in [({"order_id": "501"}, "validation"), ({"order_id": "O-501"}, "permission")]:
        e = body(await s.lookup_order.handler(args))
        assert (e["errorCategory"], e["isRetryable"]) == (cat, False)
    e = body(await s.process_refund.handler({"order_id": "O-503", "amount_usd": 99, "reason": "x"}))
    assert (e["errorCategory"], e["isRetryable"]) == ("business", False)

    # 7. PostToolUse の正規化: 文字列でも content ブロックでも変換される
    raw = json.dumps({"placed_at": 1789000000, "status": 3})
    for shape in (raw, [{"type": "text", "text": raw}], {"content": [{"type": "text", "text": raw}]}):
        out = await s.normalize_order_output(
            {"hook_event_name": "PostToolUse", "tool_response": shape}, None, None
        )
        flat = json.dumps(out["hookSpecificOutput"]["updatedToolOutput"])
        assert "2026-09-10T" in flat and "delivered" in flat and "1789000000" not in flat

    print("OK: 7 checks passed")


asyncio.run(main())
