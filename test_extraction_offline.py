"""API キーなしで動く確認。スキーマ検証・再試行・確信度ルーティング・バッチを直接呼ぶ。

    python test_extraction_offline.py
"""

import asyncio
import json

import extraction_pipeline as e


def body(result):
    return json.loads(result["content"][0]["text"])


async def main():
    # 1. validate: 完全に正しいレコードはエラー0
    good = {"invoice_id": "INV-1", "total": 100.0, "issued_date": "2026-03-04",
            "po_number": None, "category": "invoice", "category_detail": None, "confidence": 0.9}
    assert e.validate(good) == []

    # 2. validate: 必須欠落・型違い・日付形式・列挙外 を検出する [4.3][4.4]
    bad = {"invoice_id": None, "total": "100", "issued_date": "2026/03/04",
           "category": "delivery note", "confidence": 0.9}
    errs = e.validate(bad)
    assert any("invoice_id" in x for x in errs)
    assert any("total" in x for x in errs)
    assert any("issued_date" in x for x in errs)
    assert any("category" in x for x in errs)

    # 3. nullable/optional: po_number が無ければ null のままで有効（捏造しない）[4.3]
    r = e.extract({"invoice_id": "INV-2", "total": 50.0, "issued_date": "2026-03-04",
                   "category": "invoice", "confidence": 0.9})
    assert r["po_number"] is None and e.validate(r) == []

    # 4. 列挙 + other: 未知の分類は other ＋ detail になり、有効 [4.3]
    r = e.extract({"invoice_id": "INV-3", "total": 50.0, "issued_date": "2026-03-04",
                   "category": "delivery note", "confidence": 0.9})
    assert r["category"] == "other" and r["category_detail"] == "delivery note"
    assert e.validate(r) == []

    # 5. 再試行ループ: 形式ゆれ(¥文字列・/区切り日付)は再試行で直る。欠落は直らない [4.4]
    messy = {"invoice_id": "INV-4", "total": "¥1,200.00", "issued_date": "2026/03/04",
             "category": "invoice", "confidence": 0.95}
    out = e.extract_with_retry(messy)
    assert out["ok"] and out["record"]["total"] == 1200.0 and out["record"]["issued_date"] == "2026-03-04"
    assert out["attempts"] >= 2

    missing = {"total": 10.0, "issued_date": "2026-03-04", "category": "invoice", "confidence": 0.9}
    out = e.extract_with_retry(missing)
    assert out["ok"] is False and any("invoice_id" in x for x in out["errors"])

    # 6. 確信度ルーティング: 低確信度 / other は人のレビューへ。高確信度の既知分類は自動確定 [5.5]
    assert e.route_for_review({"confidence": 0.9, "category": "invoice"}) == []
    assert "low_confidence" in e.route_for_review({"confidence": 0.6, "category": "invoice"})
    assert "category_other" in e.route_for_review({"confidence": 0.99, "category": "other"})

    # 7. バッチ: 失敗分だけ再提出。ツールは null を捏造しない [4.5]
    out = e.run_batch(e.DEMO_DOCS)
    assert out["results"]["doc-1"]["status"] == "ok"            # 形式ゆれは再試行で成功
    assert "category_other" in out["results"]["doc-2"]["review"]  # 未知分類→レビュー
    assert "low_confidence" in out["results"]["doc-3"]["review"]  # 低確信度→レビュー
    assert "doc-4" in out["failed"]                             # 必須欠落→失敗
    again = e.resubmit_failures(e.DEMO_DOCS, out["failed"])
    assert set(again["results"].keys()) == set(out["failed"])   # 失敗分だけを処理
    tool_res = await e.extract_invoice.handler({"document": e.DEMO_DOCS["doc-4"]})
    assert tool_res["is_error"] is True                         # 直らないものは人へ

    print("OK: 7 checks passed")


asyncio.run(main())
