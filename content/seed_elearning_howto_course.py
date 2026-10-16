#!/usr/bin/env python3
"""「eラーニングの作り方」社内メタ講座を一括作成。
materials/AI_eラーニング制作マニュアル.pptx と video-elearning-compose スキルを教材化。
台本→スライド→本人クローン声→文字起こし→合成→Vimeo→講座登録 の型を教える。"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ADMIN_UUID = "bab3dae7-813b-43ee-b7f9-200ca779dcfd"
MEMBERS = [ADMIN_UUID, "8936dff0-704d-4d2f-bff0-c84869eec0fc", "fd11370b-58d9-4d8c-b95b-bdd851515f34"]
sys.path.insert(0, str(ROOT / "content"))
import build as b  # noqa: E402

env = b.load_env()


def lesson(section_id, title, body, order):
    b.sb(env, "POST", "lessons", {"section_id": section_id, "title": title, "body": body, "sort_order": order, "status": "published"})
    print(f"  lesson[{order}] {title}")


def assignment(section_id, title, desc, order):
    b.sb(env, "POST", "assignments", {"section_id": section_id, "title": title, "description": desc, "sort_order": order, "status": "published"})
    print(f"  assignment[{order}] {title}")


def quiz(section_id, title, desc, order, questions, passing=70):
    q = b.sb(env, "POST", "quizzes", {"section_id": section_id, "title": title, "description": desc, "passing_score": passing, "sort_order": order, "status": "published"})[0]
    for qi, qq in enumerate(questions):
        qrow = b.sb(env, "POST", "quiz_questions", {"quiz_id": q["id"], "question_type": qq["type"], "question_text": qq["q"], "explanation": qq.get("exp", ""), "sort_order": qi, "points": 1})[0]
        for oi, (text, correct) in enumerate(qq["opts"]):
            b.sb(env, "POST", "quiz_options", {"question_id": qrow["id"], "option_text": text, "is_correct": correct, "sort_order": oi})
    print(f"  quiz[{order}] {title}  ({len(questions)}問)")


def s(correct, *opts):
    return [(t, i == correct) for i, t in enumerate(opts)]


def tf(q, correct, exp):
    return {"type": "true_false", "q": q, "exp": exp, "opts": [("○（正しい）", correct), ("×（間違い）", not correct)]}


L1 = """この講座では、pipon learning に載っている**講義形式の解説動画を、自分で作れるようになる**ことを目指します。

## 完成形
- スライドを縮小して左上に置き、**右にワイプ（任意）／下にテロップ**、ナレーションは**本人のクローン声**。
- これを**半自動**で量産できる仕組み（`video-elearning-compose` スキル）があります。

## 作る流れ（全体像）
1. **台本を書く**（スライドと1対1、話し言葉）
2. **スライドを作る**（`gen_slides.py` → `slides.pptx`）
3. **ナレーション生成＋文字起こし＋合成**（`build_course.py` が一括実行）
4. **Vimeoへアップ → 講座にレッスン登録**（これも `build_course.py` が実行）

## 必要なもの
- 素材フォルダ（`content/<番号-slug>/`）に `gen_slides.py` と `script_台本_cc.md`。
- 本人クローン声の **Fish Audio モデルID**（`--voice` に渡す）。
- Vimeo アクセストークン（`.env.local`）。

> ポイントは「**台本とスライドを1対1で用意すれば、あとはコマンドがやる**」。まず全体像を掴みましょう。
"""

L2 = """動画の質は**台本で8割決まります**。話し言葉で、スライドと1対1に書きます。

## ファイル：`script_台本_cc.md`
表形式で、**1行＝1スライド**。行数とスライド枚数は**必ず一致**させます（ここがズレると切替タイミングが崩れる）。

```
| # | スライド | ナレーション |
|---|---|---|
| 1 | タイトル | 〇〇入門、ダイジェスト。…… |
| 2 | なに？ | 〇〇とは……。 |
```

## 書き方のコツ
- **話し言葉**で（読点で息継ぎ、専門語はやさしく）。記号や箇条書き記号は読み上げに向かない。
- 1スライド **40〜90秒**くらいを目安に、言い切る。
- 英字は読みを意識（「VS Code」→「ブイエスコード」等、聞いて分かる表記に）。
- 最後のスライドは「覚える3〜4つ」で締めると記憶に残る。

> 行数＝スライド枚数。話し言葉。1枚で1メッセージ。これが台本の鉄則。
"""

L3 = """スライドは **Python（`gen_slides.py`）** で作ります。共通テンプレート `_deck.build_deck` に、スライド定義（辞書のリスト）を渡すだけです。

## 最小構成
```python
from _deck import build_deck
SLIDES = [
  {"type": "title", "kicker": "〇〇入門", "title": "見出し", "sub": "サブ", "foot": "pipon learning"},
  {"kicker": "なに？", "title": "〇〇とは", "bullets": ["要点1", "要点2", "要点3"]},
  {"kicker": "手順", "title": "やること", "rows": [("キー", "説明"), ("⌘/Ctrl+S", "保存")]},
]
build_deck(SLIDES, out / "slides.pptx")
```

## スライドの型
- `title`：表紙・章の区切り（kicker＋title＋sub）。
- `bullets`：要点3つ前後（詰め込みすぎない）。
- `rows`：キー＝説明の対（ショートカットや比較に便利）。

## 大事なルール
- **スライド枚数＝台本の行数**。先に台本の行数を決めてからスライドを揃えると楽。
- 1枚は**要点3つまで**。文字が多いと読めない。

> `gen_slides.py` を実行 → `slides.pptx` ができる。中身は「辞書のリスト」を書くだけ。
"""

L4 = """ナレーションは**本人のクローン声（Fish Audio）**で生成します。ここは `build_course.py` が自動でやります。

## 何が起きるか（自動）
1. 台本のナレーション文を **Fish Audio** に渡して音声（`narration.mp3`）を生成（`--voice <モデルID>`）。
2. 音声を **whisper.cpp** で文字起こし。
3. 台本と文字起こしを**照合して、スライド切り替えタイミングを推定**。
4. スライドショー背景（`background.mp4`）とテロップ（`captions.ass`）を生成。

## 本人クローン声
- 事前に自分の声でモデルを作り、その **モデルID** を `--voice` に渡す（社内メモに控えあり）。
- 棒読みを避けるため、台本を話し言葉にしておくほど自然になります。

## 注意
- 切替タイミングは**推定**。固有名詞のカタカナ表記ゆれでズレることがある → 後述のプレビュー確認を。

> 声は本人クローン、タイミングは自動推定。だから**台本を自然な話し言葉**にするのが効きます。
"""

L5 = """**合成**とレイアウトの勘所です。スライドを縮小して余白を作り、そこにワイプ・テロップを置きます。

## レイアウトの考え方（重要）
- スライドを**80%に縮小して左上に密着**配置 → **右と下に歪みのない余白**が同時にできる。
- **右の余白にワイプ**（実演動画。無くてもよい）、**下の余白にテロップ**。
- この方式なら、スライドの見出しや帯と**絶対に重ならない**（全画面オーバーレイは事故りやすいので避ける）。

## テロップ背景色
- **黒のままにしない**。キャンバスも暗いので境界が見えない。
- スライドのアクセント色を少し暗くした色にすると、馴染みつつ読みやすい。

## プレビュー確認（省かない）
- `background.mp4` から数フレーム抜き出して、切替タイミングを目視確認。
  - `ffmpeg -nostdin -y -ss <秒> -i background.mp4 -frames:v 1 preview.png`
- ズレていたら `slide_timing.json` を直して合成し直す（合成は数秒〜十数秒で終わる）。

> 「縮小して余白を作る」方式が基本。テロップ色は黒を避け、タイミングは目視で一手間。
"""

L6 = """最後に **Vimeoアップと講座への登録**。ここも `build_course.py` が一括でやります。

## 一括実行コマンド（例）
```
python3 content/build_course.py \\
  --section-id <セクションID> \\
  --start-order <並び順の開始番号> \\
  --voice <Fish AudioモデルID> \\
  "レッスンタイトル:content/<番号-slug>"
```

## 何が起きるか
1. ナレーション生成 →（prepare_assets）→ 合成（compose_video）→ `output.mp4`。
2. **Vimeo に限定公開でアップロード**（アクセストークンを使用）。
3. **lessons テーブルにレッスンを登録**（指定セクション・並び順で）。

## 使い方のコツ
- 動画レンダリングは数分かかる → **バックグラウンド実行**して待つ。
- 1講座に複数本を続けて登録するときは `--start-order` をずらす。
- 失敗しても `output.mp4` などが残るので、合成だけ再実行もできる。

> 台本とスライドさえ用意すれば、**1コマンドで「動画→Vimeo→レッスン登録」まで**通ります。
"""

L7 = """量産するための**品質と運用**のコツ、そして**機密の扱い**です。

## 機密・コンプラ（最重要）
- **顧客名・固有の数値・個人名は必ず一般化**する（「ある製造業」「1日100件超」など）。
- 採用・個人情報に関わる素材は教材化しない。
- 社外に出す可能性があるなら、**Vimeoの公開範囲**を必ず確認。

## 品質チェックリスト
- [ ] 台本の行数＝スライド枚数
- [ ] 1スライド要点3つまで／読みやすい文字量
- [ ] 切替タイミングをプレビューで確認した
- [ ] テロップが黒背景でなく読みやすい
- [ ] 固有名詞・数値を一般化した
- [ ] 最後のスライドで「覚える3〜4つ」を提示

## 運用
- 素材は `content/<番号-slug>/` に、台本・gen_slides・slides.pptx をセットで残す（再生成できる）。
- シリーズは**ロードマップ（学習パス）に束ねる**と、受講者が順番に進めて綺麗。

> 「一般化・1対1・プレビュー・締めの要点」。この4つを守れば、速く・安全に量産できます。
"""


def main():
    c = b.sb(env, "POST", "courses", {
        "title": "eラーニングの作り方 ― 台本から動画・講座登録まで（社内向け）",
        "description": (
            "pipon learning の解説動画を自分で作れるようになる社内メタ講座。"
            "台本（スライドと1対1）→ スライド（gen_slides.py）→ 本人クローン声のナレーション＋文字起こし → "
            "背景・テロップ・ワイプの合成 → Vimeoアップ → 講座へレッスン登録、までの型を学びます。"
            "video-elearning-compose スキルと制作マニュアルを教材化。全7回＋クイズ＋制作課題。"),
        "status": "published", "is_sequential": False, "created_by": ADMIN_UUID})[0]
    sid = b.sb(env, "POST", "sections", {"course_id": c["id"], "title": "本編", "sort_order": 0})[0]["id"]
    print(f"講座作成: {c['id']}\nsection: {sid}")

    lesson(sid, "第1回 全体像 ― pipon式eラーニング動画の作り方", L1, 0)
    lesson(sid, "第2回 台本を書く ― スライドと1対1、話し言葉で", L2, 1)
    lesson(sid, "第3回 スライドを作る（gen_slides.py / _deck）", L3, 2)
    quiz(sid, "理解度チェック① 全体像・台本・スライド", "第1〜3回の確認。", 3, [
        {"type": "single_choice", "q": "台本（script_台本_cc.md）の鉄則は？",
         "opts": s(0, "行数＝スライド枚数にし、話し言葉で書く", "できるだけ長文1行で書く", "記号を多用する", "行数は気にしない"),
         "exp": "行数とスライド枚数が一致しないと切替が崩れる。話し言葉で。"},
        {"type": "single_choice", "q": "スライドは何で作る？",
         "opts": s(1, "手作業でPowerPointに打つだけ", "gen_slides.py（_deck.build_deck に辞書のリストを渡す）", "画像編集ソフト", "ブラウザ"),
         "exp": "SLIDES（辞書のリスト）→ build_deck → slides.pptx。"},
        {"type": "single_choice", "q": "1枚のスライドに載せる要点の目安は？",
         "opts": s(2, "10個以上", "文章びっしり", "3つ前後まで", "0（文字なし）"),
         "exp": "詰め込みすぎると読めない。1枚1メッセージ。"},
        {"type": "single_choice", "q": "ナレーションの声は？",
         "opts": s(3, "合成の棒読み固定", "外注", "無音", "本人のクローン声（Fish Audio、--voiceでモデルID指定）"),
         "exp": "本人クローン声。話し言葉の台本ほど自然になる。"},
        tf("最後のスライドは「覚える3〜4つ」で締めると記憶に残りやすい。", True, "○。締めの要点提示は定番。"),
    ])

    lesson(sid, "第4回 ナレーション（本人クローン声）と文字起こし", L4, 4)
    lesson(sid, "第5回 合成とレイアウトの勘所（縮小して余白／テロップ色／タイミング確認）", L5, 5)
    lesson(sid, "第6回 Vimeoアップと講座への登録（build_course.py）", L6, 6)
    lesson(sid, "第7回 品質と運用 ― 機密の一般化とチェックリスト", L7, 7)
    quiz(sid, "理解度チェック② 合成・登録・運用", "第4〜7回の確認。", 8, [
        {"type": "single_choice", "q": "レイアウトの基本方針は？",
         "opts": s(0, "スライドを縮小して左上に置き、右にワイプ・下にテロップ（重ならない余白を作る）", "全画面スライドにワイプを重ねる", "テロップは画面中央", "余白を作らない"),
         "exp": "縮小で歪みなく余白ができ、見出しと重ならない。"},
        {"type": "single_choice", "q": "テロップ背景色の注意は？",
         "opts": s(1, "黒のままにする", "黒を避け、アクセント色を少し暗くした色にする", "派手な原色にする", "透明にする"),
         "exp": "キャンバスも暗いので黒だと境界が見えない。"},
        {"type": "single_choice", "q": "動画→Vimeo→レッスン登録を一括実行するのは？",
         "opts": s(2, "手作業で1つずつ", "gen_slides.py", "build_course.py（--section-id/--start-order/--voice を指定）", "ブラウザのアップロード画面だけ"),
         "exp": "prepare→compose→Vimeoアップ→lessons登録まで一括。"},
        {"type": "single_choice", "q": "教材化で最重要の配慮は？",
         "opts": s(3, "BGMを付ける", "長くする", "難しくする", "顧客名・固有の数値・個人名を必ず一般化する"),
         "exp": "機密・個人情報は一般化。公開範囲も確認。"},
        tf("スライド切替タイミングは自動“推定”なので、background.mp4のフレームで目視確認するとよい。", True, "○。表記ゆれでズレることがある。一手間を省かない。"),
    ])

    assignment(sid, "制作課題：短いダイジェスト動画を1本作る",
               "学んだ流れで、短い解説/ダイジェスト動画を1本作ってください（テーマは自由、5〜9スライド）。\n\n"
               "【手順】\n"
               "1. content/ に素材フォルダを作り、script_台本_cc.md（行数=スライド枚数）を書く\n"
               "2. gen_slides.py で slides.pptx を生成（title/bullets/rows を使う）\n"
               "3. build_course.py で生成→Vimeo→レッスン登録（または output.mp4 まで）\n"
               "4. background.mp4 でタイミングを目視確認し、必要なら直す\n\n"
               "【提出】作った動画のVimeo URL（または output.mp4）と、台本・工夫した点・詰まった点。\n"
               "※テーマに顧客情報を使う場合は一般化すること。", 9)

    for uid in MEMBERS:
        b.sb(env, "POST", "enrollments", {"user_id": uid, "course_id": c["id"], "status": "active"})
    print(f"受講登録: {len(MEMBERS)}名\n受講URL: /courses/{c['id']}\n完成 🎓")


if __name__ == "__main__":
    main()
