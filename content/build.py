#!/usr/bin/env python3
"""1本のコンテンツ folder を、合成→Vimeoアップロード→e-learning登録まで一気に通す。

前提: folder に slides.pptx / script_台本_cc.md / narration.mp3 が揃っていること
      （台本の行数=スライド枚数）。ワイプ動画は任意。

使い方:
  # 新しい講座を作って登録
  python3 content/build.py content/02-xxx --course "社内ナレッジ / FDE編" \
      --title "レッスンのタイトル" --desc "説明"
  # 既存レッスンに動画を差し替え/登録
  python3 content/build.py content/02-xxx --lesson <lesson_id>
  # 既存の合成結果(work/)を再利用してアップロードだけやり直す
  python3 content/build.py content/02-xxx --lesson <lesson_id> --skip-prepare --skip-compose

必要な環境変数は .env.local から自動で読む（VIMEO_ACCESS_TOKEN は upload 権限必須）。
"""
import argparse, json, os, subprocess, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # プロジェクトルート
SKILL = Path.home() / ".claude/skills/video-elearning-compose/scripts"
ADMIN_UUID = "bab3dae7-813b-43ee-b7f9-200ca779dcfd"


def load_env():
    env = {}
    for line in (ROOT / ".env.local").read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def run(cmd):
    print("$", " ".join(str(c) for c in cmd))
    r = subprocess.run(cmd)
    if r.returncode != 0:
        sys.exit(f"失敗: {cmd[0]}")


def vimeo_upload(token, path, name, desc):
    api, hdr = "https://api.vimeo.com", {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.vimeo.*+json;version=3.4",
    }
    size = os.path.getsize(path)
    body = json.dumps({
        "upload": {"approach": "tus", "size": str(size)},
        "name": name, "description": desc,
        "privacy": {"view": "unlisted", "embed": "public"},
    }).encode()
    req = urllib.request.Request(f"{api}/me/videos", data=body, method="POST",
                                 headers={**hdr, "Content-Type": "application/json"})
    d = json.load(urllib.request.urlopen(req))
    vid, link = d["uri"].split("/")[-1], d["upload"]["upload_link"]
    data = open(path, "rb").read()
    patch = urllib.request.Request(link, data=data, method="PATCH", headers={
        "Tus-Resumable": "1.0.0", "Upload-Offset": "0",
        "Content-Type": "application/offset+octet-stream"})
    urllib.request.urlopen(patch)
    # 再生URL（ハッシュ付き）を取得
    req = urllib.request.Request(f"{api}/videos/{vid}?fields=link", headers=hdr)
    link = json.load(urllib.request.urlopen(req)).get("link") or f"https://vimeo.com/{vid}"
    return vid, link


def sb(env, method, path, payload=None):
    url = env["NEXT_PUBLIC_SUPABASE_URL"] + "/rest/v1/" + path
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    hdr = {"apikey": key, "Authorization": f"Bearer {key}",
           "Content-Type": "application/json", "Prefer": "return=representation"}
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=hdr)
    return json.load(urllib.request.urlopen(req))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("--wipe")
    ap.add_argument("--title")
    ap.add_argument("--desc", default="")
    ap.add_argument("--course", help="この名前で講座+セクション+レッスンを新規作成して登録")
    ap.add_argument("--lesson", help="既存レッスンID に動画URLを登録")
    ap.add_argument("--skip-prepare", action="store_true")
    ap.add_argument("--skip-compose", action="store_true")
    a = ap.parse_args()

    folder = Path(a.folder).resolve()
    work = folder / "work"
    pptx = folder / "slides.pptx"
    script = folder / "script_台本_cc.md"
    narration = folder / "narration.mp3"
    out = folder / "output.mp4"
    title = a.title or folder.name

    for f in (pptx, script, narration):
        if not f.exists():
            sys.exit(f"必須ファイルがありません: {f}")

    env = load_env()
    token = env.get("VIMEO_ACCESS_TOKEN")
    if not token:
        sys.exit(".env.local に VIMEO_ACCESS_TOKEN がありません")

    # 1) 素材生成
    if not a.skip_prepare:
        run([sys.executable, str(SKILL / "prepare_assets.py"),
             "--pptx", str(pptx), "--narration", str(narration),
             "--script", str(script), "--workdir", str(work)])

    # 2) 合成
    if not a.skip_compose:
        cmd = [sys.executable, str(SKILL / "compose_video.py"),
               "--background", str(work / "background.mp4"),
               "--captions", str(work / "captions.ass"),
               "--narration", str(narration), "--out", str(out)]
        if a.wipe:
            cmd += ["--wipe", str(Path(a.wipe).resolve())]
        run(cmd)
    if not out.exists():
        sys.exit(f"output.mp4 がありません: {out}")

    # 3) Vimeoアップロード
    print("\n=== Vimeoにアップロード中 ===")
    vid, link = vimeo_upload(token, str(out), title, a.desc)
    print(f"  video_id: {vid}\n  url: {link}")

    # 4) e-learning登録
    if a.lesson:
        sb(env, "PATCH", f"lessons?id=eq.{a.lesson}",
           {"vimeo_url": link, "vimeo_video_id": vid})
        print(f"  → レッスン {a.lesson} に登録しました")
    elif a.course:
        import subprocess as _s
        dur = int(float(_s.check_output(["ffprobe", "-v", "error", "-show_entries",
              "format=duration", "-of", "default=nk=1:nw=1", str(out)]).strip()))
        c = sb(env, "POST", "courses", {"title": a.course, "status": "published",
              "created_by": ADMIN_UUID})[0]
        se = sb(env, "POST", "sections", {"course_id": c["id"], "title": "本編", "sort_order": 0})[0]
        le = sb(env, "POST", "lessons", {"section_id": se["id"], "title": title,
              "vimeo_url": link, "vimeo_video_id": vid, "duration_seconds": dur,
              "sort_order": 0, "status": "published"})[0]
        sb(env, "POST", "enrollments", {"user_id": ADMIN_UUID, "course_id": c["id"], "status": "active"})
        print(f"  → 講座『{a.course}』作成 / レッスン {le['id']} 登録 / 管理者を受講登録")
    else:
        print("  （--course か --lesson を付けると自動でe-learningに登録します）")

    print("\n完成 🎬", link)


if __name__ == "__main__":
    main()
