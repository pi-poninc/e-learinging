#!/usr/bin/env python3
"""第二の脳 実演デモの仕上げ：wipe.mp4 を合成 → Vimeoアップ → 講座にレッスン登録。

前提: content/47-sb-demo/ に slides/台本/narration.mp3/work（prepare_assets済み）があり、
     あなたが content/47-sb-demo/wipe.mp4（画面録画）を置いたこと。

使い方:
  python3 content/finish_sb_demo.py
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILL = Path.home() / ".claude/skills/video-elearning-compose/scripts"
D = ROOT / "content/47-sb-demo"
SECTION = "6d203282-66d5-4a97-a52a-6314da8b473b"  # 「第二の脳の作り方」本編 section
SORT = 9  # 7レッスン(0-6)+クイズ(7)+課題(8) の後

sys.path.insert(0, str(ROOT / "content"))
import build as b  # noqa: E402


def main():
    wipe = D / "wipe.mp4"
    if not wipe.exists():
        sys.exit(f"画面録画がありません: {wipe}\n  → RECORDING_GUIDE.md に従って wipe.mp4 を置いてください。")
    out = D / "output.mp4"
    print("=== 合成中（スライド＋ワイプ＋テロップ＋ナレーション）===")
    b.run([sys.executable, str(SKILL / "compose_video.py"),
           "--background", str(D / "work/background.mp4"),
           "--captions", str(D / "work/captions.ass"),
           "--narration", str(D / "narration.mp3"),
           "--wipe", str(wipe),
           "--out", str(out)])
    if not out.exists():
        sys.exit("合成に失敗しました（output.mp4 がありません）")

    env = b.load_env()
    dur = int(float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nk=1:nw=1", str(out)]).strip()))
    print("=== Vimeoにアップロード中 ===")
    vid, link = b.vimeo_upload(env["VIMEO_ACCESS_TOKEN"], str(out), "第二の脳 実演デモ", "")
    le = b.sb(env, "POST", "lessons", {
        "section_id": SECTION, "title": "実演デモ：第二の脳の1日",
        "vimeo_url": link, "vimeo_video_id": vid, "duration_seconds": dur,
        "sort_order": SORT, "status": "published"})[0]
    print(f"\n完成 🎬  {link}  ({dur}s)")
    print(f"レッスン登録: {le['id']}  → /courses/d4d827d2-9093-4124-b54f-228b105aeaf4")


if __name__ == "__main__":
    main()
