#!/usr/bin/env python3
"""ターミナル入門（黒い画面が怖くなくなる・Mac/Windows両対応）を一括作成。

1コース / 1セクション: lesson 0..6（全7回）／ クイズ3本 ／ ハンズオン課題1 ＋ 受講登録。
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ADMIN_UUID = "bab3dae7-813b-43ee-b7f9-200ca779dcfd"
MEMBERS = [ADMIN_UUID, "8936dff0-704d-4d2f-bff0-c84869eec0fc", "fd11370b-58d9-4d8c-b95b-bdd851515f34"]
sys.path.insert(0, str(ROOT / "content"))
import build as b  # noqa: E402

env = b.load_env()


def lesson(section_id, title, body, order):
    le = b.sb(env, "POST", "lessons", {"section_id": section_id, "title": title, "body": body,
                                        "sort_order": order, "status": "published"})[0]
    print(f"  lesson[{order}] {title}")


def assignment(section_id, title, desc, order):
    b.sb(env, "POST", "assignments", {"section_id": section_id, "title": title, "description": desc,
         "sort_order": order, "status": "published"})
    print(f"  assignment[{order}] {title}")


def quiz(section_id, title, desc, order, questions, passing=70):
    q = b.sb(env, "POST", "quizzes", {"section_id": section_id, "title": title, "description": desc,
             "passing_score": passing, "sort_order": order, "status": "published"})[0]
    for qi, qq in enumerate(questions):
        qrow = b.sb(env, "POST", "quiz_questions", {"quiz_id": q["id"], "question_type": qq["type"],
                    "question_text": qq["q"], "explanation": qq.get("exp", ""), "sort_order": qi, "points": 1})[0]
        for oi, (text, correct) in enumerate(qq["opts"]):
            b.sb(env, "POST", "quiz_options", {"question_id": qrow["id"], "option_text": text, "is_correct": correct, "sort_order": oi})
    print(f"  quiz[{order}] {title}  ({len(questions)}問)")


def s(correct, *opts):
    return [(t, i == correct) for i, t in enumerate(opts)]


def tf(q, correct, exp):
    return {"type": "true_false", "q": q, "exp": exp, "opts": [("○（正しい）", correct), ("×（間違い）", not correct)]}


L1 = """ターミナル（黒い画面）は、**文字（コマンド）でパソコンに指示を出す道具**です。いつものマウス操作（GUI）を、1行の文字でやる、と思えばOKです。

## なぜ使うの？
- フォルダ移動・ファイル作成などが、クリックの代わりに**1行で速く・正確に**できる。
- 開発ツール（Git・Claude Code など）は、ターミナルから使うものが多い。

## 怖くない3つの理由
- **打ったことしか起きない**：勝手に何かが進むことはない。
- **「見るだけ」のコマンドは安全**：今いる場所や中身を見るだけなら、何も壊れない。
- **たいてい元に戻せる**：危険な操作（削除など）だけ気をつければよい（第7回）。

## これから覚えること
今いる場所を知る → 移動する → 作る・見る・消す → 速く打つ → 困ったときの対処。たった10個ほどのコマンドで、日常は回ります。

> 「英語の呪文」ではなく「短い命令文」。1つずつ、手を動かして覚えましょう。
"""

L2 = """まずターミナルを開いて、画面の読み方を覚えます。

## 開き方
- **Mac**：Spotlight（⌘＋スペース）で「ターミナル」と打つ／アプリ → ユーティリティ → **ターミナル.app**。
- **Windows**：スタートで「PowerShell」と打って **Windows PowerShell**。
  - 開発では **WSL（Ubuntu）** や **Git Bash** もよく使われます（Mac と同じコマンドが使えて便利）。まずは PowerShell でOK。

## 画面の読み方
```
あなた@PC名 ~ %        ← Mac（zsh）。% の後ろに入力
PS C:\\Users\\you>      ← Windows PowerShell。> の後ろに入力
```
- 行の先頭の `%` `$` `>` を **プロンプト** と呼びます。この**後ろ**に打ちます。
- プロンプトの前に出ているのが、**今いる場所（カレントフォルダ）**。ここが分かっていることが何より大事です。

> まず開いて、点滅するカーソルの前に `pwd` と打って Enter。次の回で意味を説明します。
"""

L3 = """迷子にならない基本の3つです。これだけで「今どこにいて、何があるか、どこへ動くか」が分かります。

| コマンド | 意味 | 例 |
|---|---|---|
| `pwd` | 今いる場所を表示（print working directory） | `pwd` |
| `ls` | 今の場所の中身を一覧 | `ls` |
| `cd 名前` | そのフォルダへ移動（change directory） | `cd Documents` |

## cd の便利な使い方
- `cd ..` … **1つ上**のフォルダへ
- `cd ~` または `cd` だけ … **ホーム**（自分の基地）へ
- `cd フォルダ名` … 中へ入る

※ Windows PowerShell でも `pwd` `ls` `cd` が使えます（`ls` の代わりに `dir` でも可）。

## 迷子になったら
**必ず `pwd`（今どこ？）→ `ls`（何がある？）**。この2つで現在地を取り戻せます。

> 「移動したら ls」。クセにすると、操作ミスが激減します。
"""

L4 = """作る・見る・消す。ここから“手を動かす”操作です。

| やること | Mac / WSL・Git Bash | Windows PowerShell |
|---|---|---|
| フォルダを作る | `mkdir practice` | `mkdir practice` |
| 空ファイルを作る | `touch memo.txt` | `New-Item memo.txt` |
| 中身を見る | `cat memo.txt` | `cat memo.txt` |
| 消す（ファイル） | `rm memo.txt` | `Remove-Item memo.txt` |

## 消すときの注意（大事）
- `rm` で消したものは、**ゴミ箱に入らず、その場で消えます**（元に戻しにくい）。
- フォルダごと消すのは `rm -r フォルダ名`。
- **消す前に必ず `ls` で中身を確認**。名前を1文字間違えるだけで別物を消すことがあります。

> まず `mkdir practice` → `cd practice` → `touch memo.txt` → `ls`。作って、入って、置いて、確認。
"""

L5 = """打つのを「速く・正確に」するコツです。これを知ると一気に楽になります。

## パス＝ファイルの住所
- **絶対パス**：どこから見ても同じ住所。Mac `/Users/you/Documents`、Windows `C:\\Users\\you\\Documents`。
- **相対パス**：今いる場所から見た道順。`.`＝今の場所、`..`＝1つ上、`~`＝ホーム。

## 時短ワザ
- **Tab キーで補完**：`cd Doc` まで打って **Tab** → `cd Documents/` に自動で伸びる。**打ち間違いが激減**します。
- **↑キーで履歴**：前に打ったコマンドを呼び戻して再利用。
- 長い名前は手で全部打たず、**最初の数文字＋Tab**。

> 「全部手で打たない」。Tab と ↑ を使うだけで、速さも正確さも段違いです。
"""

L6 = """うまくいかないときの対処です。ここを知っていれば、詰まっても落ち着けます。

## まず覚える
- **固まった・止めたい → `Ctrl + C`**（実行中のコマンドを中断）。
- **コピペ**：Mac は ⌘C / ⌘V。Windows ターミナルは右クリック、または `Ctrl+Shift+C / V`。

## エラーの読み方（最後の行をよく読む）
- `command not found`（`'xxx' は認識されていません`）… コマンドの打ち間違い、または未インストール。
- `No such file or directory` … 場所か名前が違う。→ `pwd` と `ls` で確認。
- `Permission denied` … 権限が足りない。場所を間違えていないか確認。

## 管理者権限（sudo）に注意
- `sudo` は管理者として実行する合図。**意味が分かるまで安易に使わない**。
- パスワードを聞かれたら、**画面に文字が出なくても入力されています**（そのまま打って Enter）。

> エラーは敵ではなく「ヒント」。あわてず最後の1行を読む。多くは `pwd`／`ls`／Tab で解決します。
"""

L7 = """最後に、安全に使うためのルールと、毎回の型です。

## 絶対に気をつけること
- **`rm -rf` は最も危険**。フォルダを中身ごと強制削除します。場所を確認せずに実行しない。`rm -rf /` のような指定は**システムを壊します**。
- **ネットでコピペしたコマンドは、中身を理解してから実行**。特に `rm` `sudo` `>`（上書き）に注意。

## 毎回の最小ワークフロー
1. `pwd` … 今どこにいる？
2. `ls` … 何がある？
3. 目的のコマンドを実行
4. もう一度 `ls` … 期待どおりになった？

この「**確認 → 実行 → 確認**」を習慣にすれば、事故はほぼ防げます。

## 続けるコツ
- コマンドは**暗記より「調べて使える」でOK**。この講座の表を見返せば十分。
- 困ったら、手を止めて現在地（`pwd`/`ls`）に戻る。わからなければ聞く。

> これで「黒い画面」は、怖い場所から**自分の道具**に変わります。次は GitHub や Git で実際に使っていきましょう。
"""


def main():
    c = b.sb(env, "POST", "courses", {
        "title": "ターミナル入門 ― 黒い画面が怖くなくなる（Mac/Windows対応）",
        "description": "まったくの初心者が、ターミナル（黒い画面）を自分の道具にできる入門講座。開き方・現在地・移動・作る/見る/消す・時短・困ったとき・安全ルールを、Mac と Windows の両方のコマンドで学びます。全7回＋クイズ＋ハンズオン。",
        "status": "published", "is_sequential": False, "created_by": ADMIN_UUID})[0]
    sid = b.sb(env, "POST", "sections", {"course_id": c["id"], "title": "本編", "sort_order": 0})[0]["id"]
    print(f"講座作成: {c['id']}\nsection: {sid}")

    lesson(sid, "第1回 ターミナルってなに？（怖くない3つの理由）", L1, 0)
    lesson(sid, "第2回 開き方と画面の読み方（Mac/Windows）", L2, 1)
    lesson(sid, "第3回 現在地と移動（pwd / ls / cd）＝迷子3点", L3, 2)
    quiz(sid, "理解度チェック① 基礎", "第1〜3回の確認。", 3, [
        {"type": "single_choice", "q": "ターミナルとは？",
         "opts": s(1, "画像を編集するソフト", "文字（コマンド）でパソコンに指示を出す道具", "インターネットの検索窓", "パスワードの保管庫"),
         "exp": "ターミナル＝コマンドでPCに指示する道具。GUI（マウス操作）を文字でやる。"},
        {"type": "single_choice", "q": "今いる場所（カレントフォルダ）を表示するコマンドは？",
         "opts": s(2, "ls", "cd", "pwd", "mkdir"), "exp": "pwd＝print working directory。今どこにいるか。"},
        {"type": "single_choice", "q": "今の場所の中身を一覧表示するのは？",
         "opts": s(0, "ls", "pwd", "cat", "rm"), "exp": "ls＝中身の一覧。移動したらまず ls。"},
        {"type": "single_choice", "q": "1つ上のフォルダへ移動するには？",
         "opts": s(1, "cd ~", "cd ..", "cd /", "ls .."), "exp": "cd .. で1つ上。cd ~ はホーム。"},
        tf("pwd や ls は「見るだけ」なので、実行しても何も壊れない。", True,
           "○。現在地や中身の確認は安全。危険なのは削除など一部だけ。"),
    ])

    lesson(sid, "第4回 作る・見る・消す（mkdir / touch / cat / rm）", L4, 4)
    lesson(sid, "第5回 パスと時短（絶対/相対・~・Tab補完・↑履歴）", L5, 5)
    quiz(sid, "理解度チェック② 操作", "第4〜5回の確認。", 6, [
        {"type": "single_choice", "q": "新しいフォルダを作るコマンドは？",
         "opts": s(2, "touch", "cat", "mkdir", "cd"), "exp": "mkdir 名前 でフォルダ作成。"},
        {"type": "single_choice", "q": "ファイルの中身を表示するのは？",
         "opts": s(0, "cat", "ls", "pwd", "rm"), "exp": "cat ファイル名 で中身を表示。"},
        {"type": "single_choice", "q": "rm でファイルを消すとどうなる？",
         "opts": s(1, "ゴミ箱に入り、あとで戻せる", "ゴミ箱に入らず、その場で消える", "名前が変わるだけ", "コピーされる"),
         "exp": "rm は即削除。消す前に ls で確認する。"},
        {"type": "single_choice", "q": "打ち間違いを減らす『補完』のキーは？",
         "opts": s(3, "Enter", "Esc", "Shift", "Tab"), "exp": "途中まで打って Tab で補完。↑ は履歴の呼び戻し。"},
        {"type": "single_choice", "q": "`~`（チルダ）が表す場所は？",
         "opts": s(1, "今いる場所", "ホームディレクトリ（自分の基地）", "1つ上のフォルダ", "ディスクの最上位"),
         "exp": "~＝ホーム。cd ~ でホームへ。. は今、.. は1つ上。"},
    ])

    lesson(sid, "第6回 困ったとき（中断・コピペ・エラーの読み方）", L6, 7)
    lesson(sid, "第7回 安全ルール＆最小ワークフロー", L7, 8)
    quiz(sid, "理解度チェック③ 困ったとき・安全", "第6〜7回の確認。", 9, [
        {"type": "single_choice", "q": "実行中のコマンドを止めたいときは？",
         "opts": s(2, "Enter を連打", "ウィンドウを閉じるしかない", "Ctrl + C", "Tab"), "exp": "Ctrl + C で中断。"},
        {"type": "single_choice", "q": "最も危険で、場所を確認せず実行してはいけないコマンドは？",
         "opts": s(1, "ls -l", "rm -rf（中身ごと強制削除）", "pwd", "cd .."),
         "exp": "rm -rf は中身ごと強制削除。rm -rf / 系はシステムを壊す。"},
        {"type": "single_choice", "q": "`No such file or directory` と出たら、まず何を確認する？",
         "opts": s(0, "pwd と ls で場所と名前を確認", "パソコンを再起動", "sudo を付けて再実行", "無視して続行"),
         "exp": "場所か名前が違う。現在地と中身を確認するのが先。"},
        tf("削除などの前に、pwd（今どこ）と ls（何がある）で確認する習慣が安全につながる。", True,
           "○。確認→実行→確認の型で事故を防ぐ。"),
    ])

    assignment(sid, "ハンズオン：フォルダとファイルを作ってみる",
               "ターミナルを開いて、実際にやってみましょう（Mac/WSL か Windows PowerShell）。\n\n"
               "1. `pwd` で今いる場所を確認。\n"
               "2. `mkdir practice` で練習フォルダを作る → `cd practice` で中へ。\n"
               "3. ファイルを作る（Mac/WSL: `touch hello.txt` ／ PowerShell: `New-Item hello.txt`）。\n"
               "4. `ls` で中身を確認。\n\n"
               "提出：`pwd` と `ls` の結果（コピペかスクリーンショット）と、詰まった点・感想を書いてください。", 10)

    for uid in MEMBERS:
        b.sb(env, "POST", "enrollments", {"user_id": uid, "course_id": c["id"], "status": "active"})
    print(f"受講登録: {len(MEMBERS)}名\n受講URL: /courses/{c['id']}\n完成 🎓")


if __name__ == "__main__":
    main()
