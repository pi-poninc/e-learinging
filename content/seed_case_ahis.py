#!/usr/bin/env python3
"""案件追体験 第1章（動物病院の電子カルテ刷新）を e-learning に登録する。

前提: マイグレーション 20261007000001_case_simulations.sql を適用済みであること
      （case_simulations / case_attempts テーブルが存在すること）。

やること:
  1. 講座「案件追体験：動物病院の電子カルテ刷新」を新規作成（published）
  2. セクション「本編」を作成
  3. case_simulations に第1章のシナリオ(JSON)を published で登録
  4. 管理者を受講登録

使い方:
  python3 content/seed_case_ahis.py
  # 既存セクションに追記する場合:
  python3 content/seed_case_ahis.py --section-id <section_uuid>

build.py の load_env / sb を再利用する（.env.local の SUPABASE_* を使用）。
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ADMIN_UUID = "bab3dae7-813b-43ee-b7f9-200ca779dcfd"
SCENARIO = Path(__file__).resolve().parent / "case_ahis_ch1_scenario.json"

sys.path.insert(0, str(ROOT / "content"))
import build as b  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--course", default="案件追体験：動物病院の電子カルテ刷新")
    ap.add_argument("--title", default="第1章：要件整理フェーズを追体験する")
    ap.add_argument("--desc", default="実案件のSlackログから再構成した要件整理フェーズを、FDEとして意思決定しながら追体験する教材。")
    ap.add_argument("--section-id", help="既存セクションに追記する場合のセクションID")
    ap.add_argument("--start-order", type=int, default=0)
    a = ap.parse_args()

    if not SCENARIO.exists():
        sys.exit(f"シナリオJSONがありません: {SCENARIO}")
    scenario = json.loads(SCENARIO.read_text(encoding="utf-8"))
    n_scenes = len(scenario.get("scenes", []))
    print(f"シナリオ読み込み: {n_scenes} 局面")

    env = b.load_env()

    if a.section_id:
        section_id, course_id = a.section_id, None
    else:
        c = b.sb(env, "POST", "courses", {
            "title": a.course, "description": a.desc,
            "status": "published", "created_by": ADMIN_UUID,
        })[0]
        se = b.sb(env, "POST", "sections", {
            "course_id": c["id"], "title": "本編", "sort_order": 0,
        })[0]
        section_id, course_id = se["id"], c["id"]
        print(f"講座『{a.course}』作成: {course_id}")

    sim = b.sb(env, "POST", "case_simulations", {
        "section_id": section_id,
        "title": a.title,
        "description": a.desc,
        "scenario": scenario,
        "sort_order": a.start_order,
        "status": "published",
    })[0]
    print(f"案件シミュレーター登録: {sim['id']}")

    if course_id:
        b.sb(env, "POST", "enrollments", {
            "user_id": ADMIN_UUID, "course_id": course_id, "status": "active",
        })
        print(f"管理者を受講登録しました。")
        print(f"\n受講URL:  /courses/{course_id}")
    print(f"直接URL:  /cases/{sim['id']}")
    print(f"編集URL:  /admin/cases/{sim['id']}/edit")
    print("\n完成 🎬 案件追体験 第1章を登録しました。")


if __name__ == "__main__":
    main()
