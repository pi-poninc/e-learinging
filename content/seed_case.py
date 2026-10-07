#!/usr/bin/env python3
"""案件シミュレーター（案件追体験）を e-learning に登録する汎用シーダー。

前提: マイグレーション 20261007000001_case_simulations.sql 適用済み。

使い方:
  # 新規講座として登録
  python3 content/seed_case.py --scenario content/case_ahis_ch1_scenario.json \
      --course "案件追体験：動物病院の電子カルテ刷新" --title "第1章：要件整理フェーズ"

  # 既存セクションに追記（シリーズの続き）
  python3 content/seed_case.py --scenario content/case_ahis_ch2_scenario.json \
      --section-id <section_uuid> --start-order 1 --title "第2章：複数社連携の開発マネジメント"

build.py の load_env / sb を再利用（.env.local の SUPABASE_* を使用）。
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ADMIN_UUID = "bab3dae7-813b-43ee-b7f9-200ca779dcfd"

sys.path.insert(0, str(ROOT / "content"))
import build as b  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scenario", required=True, help="シナリオJSONのパス")
    ap.add_argument("--title", required=True, help="案件シミュレーターのタイトル")
    ap.add_argument("--desc", default="")
    ap.add_argument("--course", help="この名前で講座を新規作成（--section-id と排他）")
    ap.add_argument("--section-id", help="既存セクションに追記する場合のセクションID")
    ap.add_argument("--start-order", type=int, default=0)
    ap.add_argument("--status", default="published", choices=["draft", "published", "archived"])
    a = ap.parse_args()

    scenario_path = Path(a.scenario)
    if not scenario_path.is_absolute():
        scenario_path = (ROOT / a.scenario).resolve()
    if not scenario_path.exists():
        sys.exit(f"シナリオJSONがありません: {scenario_path}")
    scenario = json.loads(scenario_path.read_text(encoding="utf-8"))
    print(f"シナリオ読み込み: {len(scenario.get('scenes', []))} 局面 ({scenario_path.name})")

    env = b.load_env()

    if a.section_id:
        section_id, course_id = a.section_id, None
    elif a.course:
        c = b.sb(env, "POST", "courses", {
            "title": a.course, "description": a.desc,
            "status": "published", "created_by": ADMIN_UUID,
        })[0]
        se = b.sb(env, "POST", "sections", {
            "course_id": c["id"], "title": "本編", "sort_order": 0,
        })[0]
        section_id, course_id = se["id"], c["id"]
        print(f"講座『{a.course}』作成: {course_id}")
    else:
        sys.exit("--course か --section-id のどちらかが必要です")

    sim = b.sb(env, "POST", "case_simulations", {
        "section_id": section_id, "title": a.title, "description": a.desc,
        "scenario": scenario, "sort_order": a.start_order, "status": a.status,
    })[0]
    print(f"案件シミュレーター登録: {sim['id']}")

    if course_id:
        b.sb(env, "POST", "enrollments", {
            "user_id": ADMIN_UUID, "course_id": course_id, "status": "active",
        })
        print(f"受講URL:  /courses/{course_id}")
    print(f"直接URL:  /cases/{sim['id']}")
    print(f"編集URL:  /admin/cases/{sim['id']}/edit")
    print("完成 🎬")


if __name__ == "__main__":
    main()
