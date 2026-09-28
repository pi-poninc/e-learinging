#!/usr/bin/env python3
"""既にある動画ファイル群（例: 第1回〜第15回のmp4）を、
Vimeoに一括アップロード→e-learningの1講座（複数レッスン）として登録する。

使い方:
  python3 content/bulk_upload_course.py <動画フォルダ> --course "講座名" [--section "本編"] [--dry-run]

- フォルダ内(サブフォルダ含む)の mp4/mov/m4v を対象にする
- ファイル名/フォルダ名の「第N回」や先頭の数字で自然順に並べてレッスン順にする
- 各動画は Vimeo に unlisted でアップ、lessons.vimeo_url にハッシュ付きURLを保存
- .env.local の VIMEO_ACCESS_TOKEN(upload権限) と SUPABASE_SERVICE_ROLE_KEY を使う
"""
import argparse, json, os, re, subprocess, sys, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ADMIN_UUID = "bab3dae7-813b-43ee-b7f9-200ca779dcfd"
VIDEO_EXT = {".mp4", ".mov", ".m4v", ".webm"}


def load_env():
    env = {}
    for line in (ROOT / ".env.local").read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def sort_key(p: Path):
    """『第N回』優先、なければパス中の最初の数字、それも無ければ名前で並べる。"""
    s = str(p)
    m = re.search(r"第\s*(\d+)\s*回", s)
    if m:
        return (0, int(m.group(1)), s)
    m = re.search(r"(\d+)", p.stem)
    if m:
        return (1, int(m.group(1)), s)
    return (2, 0, s)


def label(p: Path):
    m = re.search(r"第\s*(\d+)\s*回", str(p))
    if m:
        return f"第{int(m.group(1))}回"
    return p.stem


def ffprobe_dur(path):
    try:
        out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries",
              "format=duration", "-of", "default=nk=1:nw=1", str(path)])
        return int(float(out.strip()))
    except Exception:
        return 0


def vimeo_upload(token, path, name, desc=""):
    api = "https://api.vimeo.com"
    hdr = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.vimeo.*+json;version=3.4"}
    size = os.path.getsize(path)
    body = json.dumps({"upload": {"approach": "tus", "size": str(size)},
                       "name": name, "description": desc,
                       "privacy": {"view": "unlisted", "embed": "public"}}).encode()
    req = urllib.request.Request(f"{api}/me/videos", data=body, method="POST",
                                 headers={**hdr, "Content-Type": "application/json"})
    d = json.load(urllib.request.urlopen(req))
    vid, link = d["uri"].split("/")[-1], d["upload"]["upload_link"]
    # tus PATCH（大きめファイルも一括送信。必要なら分割送信に変更可）
    with open(path, "rb") as f:
        data = f.read()
    patch = urllib.request.Request(link, data=data, method="PATCH", headers={
        "Tus-Resumable": "1.0.0", "Upload-Offset": "0",
        "Content-Type": "application/offset+octet-stream"})
    urllib.request.urlopen(patch)
    req = urllib.request.Request(f"{api}/videos/{vid}?fields=link", headers=hdr)
    link = json.load(urllib.request.urlopen(req)).get("link") or f"https://vimeo.com/{vid}"
    return vid, link


def sb(env, method, path, payload=None):
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    req = urllib.request.Request(env["NEXT_PUBLIC_SUPABASE_URL"] + "/rest/v1/" + path,
        data=(json.dumps(payload).encode() if payload is not None else None),
        method=method, headers={"apikey": key, "Authorization": f"Bearer {key}",
        "Content-Type": "application/json", "Prefer": "return=representation"})
    return json.load(urllib.request.urlopen(req))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("--course", required=True)
    ap.add_argument("--section", default="本編")
    ap.add_argument("--desc", default="")
    ap.add_argument("--dry-run", action="store_true", help="アップせず対象と順番だけ表示")
    a = ap.parse_args()

    folder = Path(a.folder).expanduser().resolve()
    vids = sorted([p for p in folder.rglob("*") if p.suffix.lower() in VIDEO_EXT], key=sort_key)
    if not vids:
        sys.exit(f"動画が見つかりません: {folder}")

    print(f"対象 {len(vids)} 本:")
    for i, p in enumerate(vids, 1):
        mb = os.path.getsize(p) / 1e6
        print(f"  {i:2d}. {label(p):8s}  {p.name}  ({mb:.1f}MB)")
    if a.dry_run:
        return

    env = load_env()
    token = env.get("VIMEO_ACCESS_TOKEN")
    if not token:
        sys.exit(".env.local に VIMEO_ACCESS_TOKEN がありません")

    course = sb(env, "POST", "courses", {"title": a.course, "status": "published",
               "created_by": ADMIN_UUID})[0]
    section = sb(env, "POST", "sections", {"course_id": course["id"], "title": a.section,
               "sort_order": 0})[0]
    print(f"\n講座『{a.course}』作成: {course['id']}")

    for i, p in enumerate(vids):
        title = label(p)
        print(f"\n[{i+1}/{len(vids)}] {title}: アップロード中 … {p.name}")
        vid, link = vimeo_upload(token, str(p), title, a.desc)
        dur = ffprobe_dur(p)
        le = sb(env, "POST", "lessons", {"section_id": section["id"], "title": title,
               "vimeo_url": link, "vimeo_video_id": vid, "duration_seconds": dur,
               "sort_order": i, "status": "published"})[0]
        print(f"    → {link}  (lesson {le['id']})")

    sb(env, "POST", "enrollments", {"user_id": ADMIN_UUID, "course_id": course["id"], "status": "active"})
    print(f"\n完了 🎬 講座『{a.course}』に {len(vids)} レッスンを登録しました。")


if __name__ == "__main__":
    main()
