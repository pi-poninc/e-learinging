"""API キーなしで動く確認。検索ツールと統合ロジックだけを直接呼ぶ。

    python test_research_offline.py
"""

import asyncio
import json

import research_pipeline as r


def body(result):
    return json.loads(result["content"][0]["text"])


async def main():
    # 1. 構造化出力: finding は topic/claim/evidence/source/published を分けて持つ [2.2]
    r.STATE.update(flaky_calls=0)
    res = await r.web_search.handler({"query": "EV market size"})
    findings = body(res)["findings"]
    assert body(res)["found"] == 2
    for f in findings:
        assert set(f) >= {"topic", "claim", "evidence", "source", "published"}

    # 2. タイムアウトのエラー伝播: charging は1回目だけ transient 失敗、2回目は成功 [2.2][5.3]
    r.STATE.update(flaky_calls=0)
    e = await r.web_search.handler({"query": "EV charging infrastructure"})
    assert e["is_error"] and body(e) == {
        "errorCategory": "transient",
        "isRetryable": True,
        "message": "Search service timed out. Retrying is safe.",
    }
    ok2 = await r.web_search.handler({"query": "EV charging infrastructure"})
    assert body(ok2)["found"] == 1 and "is_error" not in ok2

    # 3. 該当なしは正常な結果（エラーではない）[5.3]
    none = await r.web_search.handler({"query": "quantum teapots on mars"})
    assert body(none)["found"] == 0 and "is_error" not in none

    # 4. 統合: 主張と出典が同じ重複は1つにまとめる
    dup = [{"topic": "x", "claim": "A", "source": "s1"}]
    merged = r.merge_findings([dup, dup])
    assert len(merged) == 1

    # 5. 食い違いは両方残す。detect_conflicts が market_size を見つける [5.6]
    groups = [body(await r.web_search.handler({"query": "EV market size"}))["findings"]]
    merged = r.merge_findings(groups)
    assert len(merged) == 2  # 2024年版と2026年版の両方が残る
    assert r.detect_conflicts(merged) == ["market_size"]

    # 6. 取得できなかったサブトピックは coverage_gaps に明示（黙って落とさない）[5.6]
    report = r.assemble_report(groups, failed_subtopics=["charging"])
    assert report["coverage_gaps"] == ["charging"]
    assert report["conflicts"] == ["market_size"]
    assert len(report["findings"]) == 2

    # 7. 構造化エラーの形: 種類・再試行可否・説明 ＋ is_error
    r.STATE.update(flaky_calls=0)
    e = body(await r.web_search.handler({"query": "charging"}))
    assert e["errorCategory"] == "transient" and e["isRetryable"] is True

    print("OK: 7 checks passed")


asyncio.run(main())
