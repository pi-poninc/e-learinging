#!/usr/bin/env python3
"""複数のコンテンツフォルダを「1つの講座（複数レッスン）」としてまとめて作る。

各フォルダに slides.pptx / script_台本_cc.md が揃っている前提。
--voice を付けると台本から Fish Audio（自分のクローン声）で narration.mp3 を自動生成し、
video-elearning-compose スキルで合成 → Vimeo に unlisted アップ → e-learning に登録する。

使い方:
  python3 content/build_course.py \
      --course "工場の電気設備 入門（大阪鉛様向け）" \
      --voice <Fish声モデルID> \
      "第1回 電気の超基本:content/03-elec-basics" \
      "第2回 受電とキュービクル:content/04-jyuden-cubicle" \
      "第3回 容量・料金・保安:content/05-capacity-fee-law" \
      "第4回 安全とpipon案件:content/06-safety-pipon"

  # 既存講座に追記したいとき（course作成済み）
  python3 content/build_course.py --section-id <section_uuid> --start-order 5 --voice <ID> "タイトル:フォルダ" ...

build.py と同じく .env.local の VIMEO_ACCESS_TOKEN / SUPABASE_SERVICE_ROLE_KEY / FISH_AUDIO_API_KEY を使う。
合成・アップロード部分は build.py の関数を import して再利用する（ロジックの二重管理を避ける）。
"""
import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILL = Path.home() / ".claude/skills/video-elearning-compose/scripts"
ADMIN_UUID = "bab3dae7-813b-43ee-b7f9-200ca779dcfd"

sys.path.insert(0, str(ROOT / "content"))
import build as b  # build.py の load_env / fish_tts / vimeo_upload / sb / script_narration_text を再利用  # noqa: E402


def ffprobe_dur(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries",
          "format=duration", "-of", "default=nk=1:nw=1", str(path)])
    return int(float(out.strip()))


def build_one(env, folder: Path, voice, regen_voice, skip_prepare, skip_compose):
    """1フォルダを合成して output.mp4 を作り、(vimeo_video_id, vimeo_url, duration) を返す。"""
    work = folder / "work"
    pptx = folder / "slides.pptx"
    script = folder / "script_台本_cc.md"
    narration = folder / "narration.mp3"
    out = folder / "output.mp4"
    for f in (pptx, script):
        if not f.exists():
            sys.exit(f"必須ファイルがありません: {f}")

    if voice and (regen_voice or not narration.exists()):
        fk = env.get("FISH_AUDIO_API_KEY")
        if not fk:
            sys.exit(".env.local に FISH_AUDIO_API_KEY がありません")
        text = "\n".join(b.script_narration_text(script))
        print(f"  === Fish Audioでナレーション生成中 ({folder.name}) ===")
        b.fish_tts(fk, text, voice, str(narration))
    if not narration.exists():
        sys.exit(f"narration.mp3 がありません（--voice でFish生成するか手動配置）: {narration}")

    if not skip_prepare:
        b.run([sys.executable, str(SKILL / "prepare_assets.py"),
               "--pptx", str(pptx), "--narration", str(narration),
               "--script", str(script), "--workdir", str(work)])
    if not skip_compose:
        b.run([sys.executable, str(SKILL / "compose_video.py"),
               "--background", str(work / "background.mp4"),
               "--captions", str(work / "captions.ass"),
               "--narration", str(narration), "--out", str(out)])
    if not out.exists():
        sys.exit(f"output.mp4 がありません: {out}")

    token = env["VIMEO_ACCESS_TOKEN"]
    print(f"  === Vimeoにアップロード中 ({folder.name}) ===")
    vid, link = b.vimeo_upload(token, str(out), folder.name, "")
    return vid, link, ffprobe_dur(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("lessons", nargs="+", help='"レッスンタイトル:フォルダパス" を順番に並べる')
    ap.add_argument("--course", help="この名前で講座を新規作成（--section-id と排他）")
    ap.add_argument("--desc", default="")
    ap.add_argument("--section-id", help="既存セクションに追記する場合のセクションID")
    ap.add_argument("--start-order", type=int, default=0, help="追記時の開始 sort_order")
    ap.add_argument("--voice", help="Fish Audioの声モデルID")
    ap.add_argument("--regen-voice", action="store_true")
    ap.add_argument("--skip-prepare", action="store_true")
    ap.add_argument("--skip-compose", action="store_true")
    a = ap.parse_args()

    items = []
    for spec in a.lessons:
        if ":" not in spec:
            sys.exit(f'書式は "タイトル:フォルダ" です: {spec}')
        title, folder = spec.split(":", 1)
        items.append((title.strip(), (ROOT / folder.strip()).resolve()))

    env = b.load_env()

    # 先に全フォルダを合成＆アップロード（途中で落ちてもVimeoには残る）
    built = []
    for i, (title, folder) in enumerate(items):
        print(f"\n[{i+1}/{len(items)}] {title}  ({folder})")
        vid, link, dur = build_one(env, folder, a.voice, a.regen_voice,
                                   a.skip_prepare, a.skip_compose)
        print(f"    → {link}  ({dur}s)")
        built.append((title, vid, link, dur))

    # 講座・セクション
    if a.section_id:
        section_id = a.section_id
        base = a.start_order
        course_id = None
    elif a.course:
        c = b.sb(env, "POST", "courses", {"title": a.course, "status": "published",
               "created_by": ADMIN_UUID})[0]
        se = b.sb(env, "POST", "sections", {"course_id": c["id"], "title": "本編", "sort_order": 0})[0]
        section_id, base, course_id = se["id"], 0, c["id"]
        print(f"\n講座『{a.course}』作成: {course_id}")
    else:
        sys.exit("--course か --section-id のどちらかが必要です")

    for i, (title, vid, link, dur) in enumerate(built):
        le = b.sb(env, "POST", "lessons", {"section_id": section_id, "title": title,
               "vimeo_url": link, "vimeo_video_id": vid, "duration_seconds": dur,
               "sort_order": base + i, "status": "published"})[0]
        print(f"  + レッスン登録: {title}  (lesson {le['id']})")

    if course_id:
        b.sb(env, "POST", "enrollments", {"user_id": ADMIN_UUID, "course_id": course_id, "status": "active"})
    print(f"\n完成 🎬 {len(built)} レッスンを登録しました。")


if __name__ == "__main__":
    main()
