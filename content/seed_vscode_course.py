#!/usr/bin/env python3
"""VS Code 入門（はじめての人向け・Mac/Windows・非エンジニアも対象）を一括作成。"""
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


L1 = """VS Code（Visual Studio Code）は、Microsoft が無料で配っている **テキスト／コードの編集ソフト（エディタ）** です。プログラミングだけでなく、**メモ・設定ファイル・原稿**など「文字のファイル」なら何でも快適に扱えます。

## なぜ使うの？
- **軽くて速い・無料**。Windows / Mac どちらでも同じ使い勝手。
- **拡張機能**で、日本語化・言語サポート・整形など、必要な機能だけ足せる。
- **ターミナルが内蔵**されていて、Claude Code などを同じ画面から動かせる。
- **Git連携**で、黒い画面なしに変更の記録・共有ができる。

## 誰向け？
エンジニアでなくてもOK。「Claude Code を使う」「設定ファイルを直す」「資料をMarkdownで書く」――そんな場面の“作業場”になります。

> まずは「高機能なメモ帳」くらいの気持ちで大丈夫。次の回でインストールして開きます。
"""

L2 = """インストールして、画面の見方を覚えます。

## インストール
1. **code.visualstudio.com** から、自分のOS（Mac / Windows）用をダウンロードしてインストール。
2. 起動する。

## 日本語にする
- 左の四角が重なったアイコン（**拡張機能**）→ `Japanese Language Pack` を検索して Install → 再起動。表示が日本語になります。

## 画面の4つのエリア
| 場所 | 役割 |
|---|---|
| 左端の縦の帯（アクティビティバー） | エクスプローラー・検索・ソース管理・拡張機能の切り替え |
| サイドバー | 選んだ機能の中身（例：ファイル一覧） |
| 中央（エディタ） | ファイルを開いて編集するところ。タブで複数開ける |
| 下（パネル） | ターミナル・問題・出力など |

> まず「左の帯でモードを切り替え、中央で編集」という構造を覚えればOKです。
"""

L3 = """VS Code の基本は「**フォルダを開いて**、中のファイルを編集・保存」です。

## フォルダを開く
- **ファイル → フォルダーを開く**（Open Folder）で、作業したいフォルダを開く。
- 左の **エクスプローラー** にファイル一覧が出ます。クリックで開く、タブで切り替え。

## 新規ファイル・編集・保存
- エクスプローラーの新規ファイルアイコン、または **ファイル → 新しいファイル**。
- 編集したら **保存**：`Ctrl + S`（Mac は `⌘ + S`）。タブに「●」が付いていたら未保存のサイン。
- **自動保存**：ファイル → 自動保存 をオンにすると、保存忘れが減ります。

## よく使う最初の操作
- 複数ファイルをタブで開く／ドラッグで左右に並べる（分割）。
- フォルダ単位で開くと、プロジェクト全体を見渡せます。

> 「フォルダを開く → 編集 → ⌘/Ctrl+S」。これが土台です。
"""

L4 = """探す・直す・呼び出すを速くします。

## 検索・置換
- **ファイル内検索**：`Ctrl/⌘ + F`。置換は続けて `Ctrl/⌘ + H`。
- **フォルダ全体を検索**：`Ctrl/⌘ + Shift + F`（左の虫めがね）。どのファイルに何があるか一気に探せます。
- **ファイル名で開く**：`Ctrl/⌘ + P` → 名前を打つとすぐ開ける。

## コマンドパレット（これが主役）
- `Ctrl/⌘ + Shift + P` で **コマンドパレット**。VS Code の機能は**ほぼ全部ここから**呼べます。
- 例：「設定」「ターミナル」「Git」などを名前で検索して実行。**迷ったらまずパレット**。

## 名前の変更
- ファイルやコード上の名前を **F2** でまとめてリネーム。

> 「困ったら ⌘/Ctrl+Shift+P」。覚えるショートカットは、まずこれ1つでOK。
"""

L5 = """VS Code には**ターミナルが内蔵**されています。アプリを行き来せず、同じ画面で完結します。

## 開き方
- **`Ctrl + @`（バッククォート、Jキーの左あたり）** で下に表示／非表示。
- メニューからは **ターミナル → 新しいターミナル**。

## 何がうれしい？
- 開いているフォルダが**そのまま作業場所**（`pwd` がそのフォルダ）。移動の手間がない。
- ここから **Claude Code（`claude`）** や git などのコマンドをそのまま実行できる。
- 複数のターミナルを並べて使える。

## 使い方の基本
- ターミナルの操作は「ターミナル入門」講座の通り（`pwd` / `ls` / `cd`…）。
- 止めたいときは `Ctrl + C`。

> 編集（エディタ）とコマンド（ターミナル）が1画面に。これが VS Code を使う大きな理由です。
"""

L6 = """**拡張機能（Extensions）** で、自分に必要な機能だけを足せます。

## 入れ方
- 左の **拡張機能** アイコン（四角が重なった形）→ 検索 → **Install**。

## 最初に入れると便利
- **Japanese Language Pack**：表示を日本語に。
- **Prettier**：コードや文章の自動整形。
- 使う言語のサポート（Python / など）：色分け・補助が効く。

## 安全のために（重要）
- 拡張機能は他人が作ったプログラムです。**発行元（Publisher）とインストール数・評価を確認**し、**信頼できるものだけ**入れる。
- むやみに大量に入れない（重くなる・リスクが増える）。

> 「必要なものを、信頼できるものだけ」。拡張は強力ですが、入れすぎ・怪しいものに注意。
"""

L7 = """VS Code なら、**黒い画面なしで Git** が使えます（GitHub講座の内容を、ボタン操作で）。

## ソース管理タブ
- 左の **ソース管理**（枝分かれのアイコン）を開くと、**変更したファイルの一覧**が出ます。
- 変更の中身（差分）がクリックで見える。

## コミットとプッシュ
1. 変更に **＋（ステージ）**。
2. 上のメッセージ欄に「何をしたか」を書いて **コミット（✓）**。
3. **同期（Sync / Push）** でクラウド（GitHub）へ。

## GitHub 連携
- GitHub アカウントでサインインすると、リポジトリのクローンや作成も VS Code から。
- 仕組み自体は「GitHub講座」と同じ。VS Code は**それを見やすいボタンにした**もの。

> コマンドが苦手でも、ここで「変更を見て・記録して・共有」ができます。
"""

L8 = """最後に、時短の設定と、安全に使うコツです。

## 設定とテーマ
- **設定**：`Ctrl/⌘ + ,`。フォントサイズ・自動保存・折り返しなどを調整。
- **テーマ**：見やすい配色に（コマンドパレットで「配色テーマ」）。
- **設定同期（Settings Sync）**：GitHub/Microsoft アカウントでログインすると、別のPCでも同じ設定・拡張を引き継げます。

## 覚えておくと速いショートカット
| 操作 | キー |
|---|---|
| コマンドパレット | `Ctrl/⌘ + Shift + P` |
| ファイルを名前で開く | `Ctrl/⌘ + P` |
| 保存 | `Ctrl/⌘ + S` |
| 検索 / 全体検索 | `Ctrl/⌘ + F` / `+ Shift + F` |
| ターミナル表示 | `Ctrl + @`（バッククォート） |

## 安全
- **ワークスペースの信頼（Workspace Trust）**：知らないフォルダを開くと確認が出ます。中身を把握できないものは「制限モード」のままに。
- 拡張は信頼できるものだけ（第6回）。

> まずは「フォルダを開く・編集して保存・ターミナルを開く・パレットで探す」。これで日常は十分回ります。
"""


def main():
    c = b.sb(env, "POST", "courses", {
        "title": "VS Code 入門 ― はじめての人向け（Mac/Windows）",
        "description": "まったくの初心者が、無料エディタ VS Code を『作業場』として使えるようになる入門講座。インストールと画面・フォルダを開いて編集/保存・検索とコマンドパレット・内蔵ターミナル（Claude Code）・拡張機能・Git連携（黒い画面なし）・時短と安全設定を、Mac/Windows両対応で学びます。全8回＋クイズ＋ハンズオン。",
        "status": "published", "is_sequential": False, "created_by": ADMIN_UUID})[0]
    sid = b.sb(env, "POST", "sections", {"course_id": c["id"], "title": "本編", "sort_order": 0})[0]["id"]
    print(f"講座作成: {c['id']}\nsection: {sid}")

    lesson(sid, "第1回 VS Codeってなに？なぜ使う", L1, 0)
    lesson(sid, "第2回 インストールと画面の見方（日本語化）", L2, 1)
    lesson(sid, "第3回 フォルダを開いて編集・保存", L3, 2)
    quiz(sid, "理解度チェック① 基本操作", "第1〜3回の確認。", 3, [
        {"type": "single_choice", "q": "VS Code とは？",
         "opts": s(1, "表計算ソフト", "無料のテキスト／コード編集ソフト（エディタ）", "ウイルス対策ソフト", "ブラウザ"),
         "exp": "Microsoft 製の無料エディタ。文字のファイルなら何でも扱える。"},
        {"type": "single_choice", "q": "VS Code での作業の基本は？",
         "opts": s(0, "フォルダーを開く（Open Folder）", "画像を読み込む", "印刷する", "電源を切る"),
         "exp": "フォルダを開くと、左のエクスプローラーに一覧が出る。"},
        {"type": "single_choice", "q": "ファイルを保存するショートカットは？",
         "opts": s(2, "Ctrl/⌘ + P", "Ctrl/⌘ + F", "Ctrl/⌘ + S", "F2"),
         "exp": "保存は Ctrl/⌘ + S。タブの●は未保存の印。自動保存もある。"},
        {"type": "single_choice", "q": "左側でファイル一覧を表示する場所は？",
         "opts": s(0, "エクスプローラー（サイドバー）", "ステータスバー", "タイトルバー", "ゴミ箱"),
         "exp": "アクティビティバー→エクスプローラーでファイル一覧。"},
        tf("VS Code は拡張機能で、必要な機能を後から足せる。", True, "○。日本語化・整形・言語サポートなどを追加できる。"),
    ])

    lesson(sid, "第4回 検索・置換・コマンドパレット", L4, 4)
    lesson(sid, "第5回 内蔵ターミナルと Claude Code", L5, 5)
    lesson(sid, "第6回 拡張機能（Extensions）と安全", L6, 6)
    quiz(sid, "理解度チェック② 効率化・ターミナル・拡張", "第4〜6回の確認。", 7, [
        {"type": "single_choice", "q": "VS Code の機能をほぼ何でも呼び出せる『コマンドパレット』のキーは？",
         "opts": s(1, "Ctrl/⌘ + S", "Ctrl/⌘ + Shift + P", "Ctrl + C", "Alt + F4"),
         "exp": "迷ったら Ctrl/⌘ + Shift + P。名前で機能を探して実行。"},
        {"type": "single_choice", "q": "内蔵ターミナルを開く／閉じるキーは？",
         "opts": s(2, "Ctrl/⌘ + S", "F2", "Ctrl + @（バッククォート）", "Ctrl/⌘ + P"),
         "exp": "Ctrl + バッククォートで下にターミナルを表示。"},
        {"type": "single_choice", "q": "内蔵ターミナルの利点は？",
         "opts": s(0, "開いているフォルダがそのまま作業場所になり、claude 等をその画面で実行できる", "画像を編集できる", "印刷が速い", "ウイルスを消す"),
         "exp": "エディタとコマンドが1画面に。移動の手間がない。"},
        {"type": "single_choice", "q": "拡張機能を入れるときの注意は？",
         "opts": s(1, "数を多いほど良い", "発行元・評価を確認し、信頼できるものだけ入れる", "必ず全部入れる", "注意は不要"),
         "exp": "拡張は他人のプログラム。信頼できるものだけ、入れすぎない。"},
        tf("表示を日本語にする拡張機能（Japanese Language Pack）がある。", True, "○。入れて再起動で日本語表示に。"),
    ])

    lesson(sid, "第7回 Git連携（黒い画面なしで記録・共有）", L7, 8)
    lesson(sid, "第8回 時短の設定と安全（設定同期・ワークスペース信頼）", L8, 9)
    quiz(sid, "理解度チェック③ Git連携・設定・安全", "第7〜8回の確認。", 10, [
        {"type": "single_choice", "q": "VS Code の『ソース管理』タブでできることは？",
         "opts": s(0, "変更の確認・コミット・プッシュ（黒い画面なしでGit操作）", "動画編集", "表計算", "メール送信"),
         "exp": "GitHub講座の内容を、ボタン操作でできる。"},
        {"type": "single_choice", "q": "別のPCでも同じ設定・拡張を引き継ぐ機能は？",
         "opts": s(1, "自動保存", "設定同期（Settings Sync）", "ズーム", "印刷"),
         "exp": "GitHub/Microsoftアカウントでログインして同期。"},
        {"type": "single_choice", "q": "知らないフォルダを開いたときに、安全のため確認される仕組みは？",
         "opts": s(2, "自動保存", "テーマ", "ワークスペースの信頼（Workspace Trust）", "ミニマップ"),
         "exp": "把握できないフォルダは制限モードのまま扱える。"},
        {"type": "single_choice", "q": "名前（ファイルやコード）をまとめて変更するキーは？",
         "opts": s(3, "Ctrl/⌘ + S", "Ctrl + C", "Ctrl/⌘ + F", "F2"),
         "exp": "F2 でリネーム。"},
        tf("怪しい発行元の拡張機能は入れない方がよい。", True, "○。拡張はプログラム。信頼できるものだけに。"),
    ])

    assignment(sid, "ハンズオン：VS Code で作業してみる",
               "実際に手を動かしてみましょう（Mac / Windows どちらでも）。\n\n"
               "1. フォルダを1つ開く（なければ新規作成して開く）。\n"
               "2. 新しいファイル `memo.md` を作り、3行ほど書いて保存（⌘/Ctrl+S）。\n"
               "3. コマンドパレット（⌘/Ctrl+Shift+P）を開いて、何か1つ機能を実行してみる。\n"
               "4. 内蔵ターミナル（Ctrl+@）を開いて `pwd` と打ってみる。\n"
               "5. （任意）拡張機能を1つ（例：Japanese Language Pack）入れる。\n\n"
               "提出：やってみた画面のスクリーンショットか、詰まった点・感想を書いてください。", 11)

    for uid in MEMBERS:
        b.sb(env, "POST", "enrollments", {"user_id": uid, "course_id": c["id"], "status": "active"})
    print(f"受講登録: {len(MEMBERS)}名\n受講URL: /courses/{c['id']}\n完成 🎓")


if __name__ == "__main__":
    main()
