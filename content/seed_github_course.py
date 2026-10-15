#!/usr/bin/env python3
"""GitHubの使い方（はじめての人向け・Web＋GitHub Desktop・黒い画面なし）を一括作成。

1コース / 1セクション:
  lesson 0..7（全8回）／ クイズ3本（基礎/実践/安全）／ ハンズオン課題1
  ＋ 管理者・南條・小中 を受講登録
build.py の load_env / sb を再利用。
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
    print(f"  lesson[{order}] {title}  {le['id']}")


def assignment(section_id, title, desc, order):
    a = b.sb(env, "POST", "assignments", {"section_id": section_id, "title": title, "description": desc,
             "sort_order": order, "status": "published"})[0]
    print(f"  assignment[{order}] {title}  {a['id']}")


def quiz(section_id, title, desc, order, questions, passing=70):
    q = b.sb(env, "POST", "quizzes", {"section_id": section_id, "title": title, "description": desc,
             "passing_score": passing, "sort_order": order, "status": "published"})[0]
    for qi, qq in enumerate(questions):
        qrow = b.sb(env, "POST", "quiz_questions", {"quiz_id": q["id"], "question_type": qq["type"],
                    "question_text": qq["q"], "explanation": qq.get("exp", ""), "sort_order": qi, "points": 1})[0]
        for oi, (text, correct) in enumerate(qq["opts"]):
            b.sb(env, "POST", "quiz_options", {"question_id": qrow["id"], "option_text": text,
                 "is_correct": correct, "sort_order": oi})
    print(f"  quiz[{order}] {title}  ({len(questions)}問)")


def s(correct, *opts):
    return [(t, i == correct) for i, t in enumerate(opts)]


def tf(q, correct, exp):
    return {"type": "true_false", "q": q, "exp": exp,
            "opts": [("○（正しい）", correct), ("×（間違い）", not correct)]}


L1 = """GitHub（ギットハブ）は、ファイルやプログラムを **安全に保存し、履歴を残し、みんなで一緒に作業できる** ネット上の場所です。黒い画面（コマンド）を使わなくても、ブラウザと専用アプリ（GitHub Desktop）だけで使えます。

## 何がうれしいの？
- **履歴が残る・戻せる**：いつ・何を変えたかが全部記録される。失敗しても前に戻せる。
- **共同作業が安全**：同じファイルを複数人で触っても、ぶつからないように管理できる。
- **公開できる**：自分の作ったものを世界に見せられる（ポートフォリオにもなる）。

## まず覚える言葉（4つだけ）
| 言葉 | 意味（ざっくり） |
|---|---|
| リポジトリ（repository / repo） | プロジェクトの**保管箱**。1つの作品＝1つのリポジトリ |
| コミット（commit） | 変更を**記録**すること。「何をしたか」の一言メッセージを付ける |
| プッシュ（push） | 自分のPCの変更を**クラウド（GitHub）へ反映**する |
| クローン（clone） | クラウドのリポジトリを**自分のPCに取り込む** |

最初はこれだけでOK。次の回からアカウントを作って、実際に触っていきます。
"""

L2 = """GitHub は無料で始められます。

## アカウントを作る
1. ブラウザで **github.com** を開く → 右上 **Sign up**。
2. メールアドレス・ユーザー名・パスワードを入力。ユーザー名はURLにも使われます（例: github.com/あなたの名前）。
3. 確認メールが届いたら認証。

## 最初にやる安全設定（重要）
- **2段階認証（2FA）を必ずオンに**：Settings → Password and authentication。乗っ取り防止の基本です。
- プロフィール画像・自己紹介を設定すると、相手に安心感が出ます。

## 公開と非公開
- **Public（公開）**：世界中の誰でも見られる。
- **Private（非公開）**：自分（と招待した人）だけ。仕事や練習中はこちらが安心。
- あとから切り替えもできます。

> ポイント：**2FAだけは今すぐ設定**。ここをサボると、あとで大変なことになります。
"""

L3 = """「保管箱」であるリポジトリを作ります。

## 作り方
1. 右上の **＋** → **New repository**。
2. **Repository name**（例: `my-first-repo`）を入力。
3. **Description**（説明）は任意。
4. **Public / Private** を選ぶ（練習なら Private が安心）。
5. **Add a README file** に**チェック**を入れる。
6. **Create repository**。

## README とは？
`README.md` は、そのプロジェクトの**説明書**です。リポジトリを開くと最初に表示されます。**Markdown（マークダウン）** という簡単な記法で書けます。

```
# プロジェクト名
これは何のプロジェクトか。

## 使い方
- 箇条書き
- [リンク](https://example.com)
```

## 画面の見方（タブ）
- **Code**：ファイルの一覧。
- **Issues**：やること・バグ・アイデアの管理（第6回）。
- **Pull requests**：変更の提案（第7回）。

> まず1つ、空でいいのでリポジトリを作ってみましょう。READMEを1行書くだけでも立派な第一歩です。
"""

L4 = """黒い画面を使わず、**ブラウザだけ**でファイルを作って保存できます。

## 新しいファイルを作る
1. リポジトリの **Code** タブ → **Add file** → **Create new file**。
2. 上の欄にファイル名（例: `memo.md`）、下の欄に中身を書く。
3. ページ下の **Commit changes**。

## コミット＝「保存して記録」
- **Commit message** に「何をしたか」を一言（例: `メモを追加`）。
- これで変更が記録されます。コミットのたびに履歴が増えていきます。

## ファイルをアップロードする
- **Add file → Upload files** で、PCの画像や資料をドラッグ＆ドロップ → Commit。

## 履歴を見る・戻る
- ファイル右上の **History**、またはリポジトリの **Commits** で過去の状態を確認でき、必要なら戻せます。

> 小さな作業はこれだけで完結します。「編集 → Commit changes」を繰り返すだけ。
"""

L5 = """PC上のファイルと GitHub を、アプリで**同期**します。黒い画面はゼロです。

## 準備
1. **desktop.github.com** から **GitHub Desktop** をインストール。
2. 起動して GitHub アカウントで **サインイン**。

## リポジトリをPCに取り込む（Clone）
- File → **Clone repository** → 自分のリポジトリを選ぶ → 保存場所を決めて Clone。
- これでPCのフォルダとして開けます。

## いつもの流れ（これだけ覚える）
1. いつものアプリ（メモ帳・エディタ等）でファイルを編集して保存。
2. GitHub Desktop に**変更が自動で表示**される。
3. 左下の **Summary** に変更内容を一言（＝コミットメッセージ）。
4. **Commit to main** を押す（記録）。
5. 右上の **Push origin** を押す（クラウドへ反映）。

## 他の人・ブラウザの変更を取り込む
- **Fetch origin** → 変更があれば **Pull**。作業の前に Pull しておくと安全です。

> 「編集 → Commit → Push」「始める前に Pull」。この2つが身につけば十分です。
"""

L6 = """**Issues（イシュー）** は、やること・バグ・アイデアを貼っておく**付箋ボード**です。

## 使い方
1. **Issues** タブ → **New issue**。
2. タイトル（例: `トップページに自己紹介を追加`）＋ 内容。
3. **Create**。

## 便利な機能
- **Assignees**：担当者を決める。
- **Labels**：`bug` `idea` などの色付きラベルで分類。
- **チェックリスト**：本文に `- [ ] やること` と書くと、チェックできるToDoになる。
- **コメント**：Issueの中で相談・経過を記録。

## 終わったら
- 対応が済んだら **Close**。あとから見返せます。

> 「頭の中のやること」をIssueにすると、忘れないし、チームにも見える。1人の作業でも便利です。
"""

L7 = """**ブランチ** と **Pull Request** は、安全に変更するための仕組みです。1人でも役立ちます。

## ブランチ＝作業用のコピー
- `main`（本番）を直接いじると、失敗したとき困ります。
- そこで **ブランチ**（例: `add-profile`）を作り、そこで自由に試します。`main` は無傷のまま。
- GitHub Desktop：**Current branch → New branch**。ブラウザ：ブランチ選択メニューから作成。

## Pull Request（プルリク／PR）＝変更の提案
1. ブランチで編集・コミット・プッシュ。
2. GitHub上で **Compare & pull request** → PRを作成。
3. PR＝「このブランチの変更を `main` に入れてください」という**提案**。中身の差分が見える。
4. （チームなら）レビューしてもらう → 問題なければ **Merge**（取り込み）。

## なぜPR？
- 変更が**レビューできる**。
- 何を・なぜ変えたかが**記録**される。
- 1人でも「変更をひとまとまりにする単位」として便利。

> 流れ：**ブランチを切る → 変更 → PR → マージ**。これが共同作業の基本形です。
"""

L8 = """最後に、安全に使うためのルールと、困ったときの対処です。

## 安全ルール
- **秘密情報を上げない**：パスワード・APIキー・個人情報をコミットしないこと。一度上げると履歴に残ります。
- **公開範囲に注意**：Public は世界中に見えます。見せたくないものは **Private**。
- **.gitignore**：アップロードしたくないファイル（鍵・巨大ファイル等）を書いておくと、除外されます。

## 困ったとき
- **コンフリクト（衝突）**：同じ場所を別々に変更すると起きます。慌てず、残す方を選ぶ／GitHub Desktop の案内に従う。作業前に **Pull** しておくと起きにくい。
- **間違えた**：コミット履歴から前の状態に戻せます。PRはマージ前なら閉じればOK。
- **消してしまった**：履歴に残っていれば復元できます。

## 続けるコツ
- **コミットは小さく・こまめに**（戻しやすい・原因が分かりやすい）。
- メッセージは「何をしたか」を一言。
- **わからなければ聞く**。みんな最初は分かりません。

> これで「ブラウザ＋GitHub Desktop で、保存・共有・共同作業ができる」状態です。あとは小さく毎日触るだけ。
"""


def main():
    c = b.sb(env, "POST", "courses", {
        "title": "GitHubの使い方 ― はじめての人向け（黒い画面なし）",
        "description": "まったくの初心者が、ブラウザと GitHub Desktop だけで GitHub を使えるようになる入門講座。"
                       "アカウント作成・リポジトリ・ブラウザ編集・PC同期・Issues・Pull Request・安全ルールを、コマンドなしで学びます。全8回＋クイズ＋ハンズオン。",
        "status": "published", "is_sequential": False, "created_by": ADMIN_UUID})[0]
    sid = b.sb(env, "POST", "sections", {"course_id": c["id"], "title": "本編", "sort_order": 0})[0]["id"]
    print(f"講座作成: {c['id']}\nsection: {sid}")

    lesson(sid, "第1回 GitHubってなに？（まず言葉を4つ）", L1, 0)
    lesson(sid, "第2回 アカウント作成と安全設定（2FA）", L2, 1)
    lesson(sid, "第3回 リポジトリを作る／README を書く", L3, 2)
    quiz(sid, "理解度チェック① GitHubの基礎", "第1〜3回の確認。", 3, [
        {"type": "single_choice", "q": "リポジトリ（repository）とは？",
         "opts": s(1, "コミットのメッセージ", "プロジェクトの保管箱（1作品＝1つ）", "パスワードの保管庫", "黒い画面のこと"),
         "exp": "リポジトリ＝プロジェクトの保管箱。ファイル・履歴がここに入る。"},
        {"type": "single_choice", "q": "コミット（commit）とは？",
         "opts": s(2, "ファイルを削除すること", "アカウントを作ること", "変更を記録し、一言メッセージを付けること", "世界に公開すること"),
         "exp": "コミット＝変更の記録＋「何をしたか」の一言。履歴になる。"},
        {"type": "single_choice", "q": "README.md は何のファイル？",
         "opts": s(0, "プロジェクトの説明書（最初に表示される）", "パスワードの一覧", "削除予定の一時ファイル", "画像ファイル"),
         "exp": "README＝説明書。Markdownで書き、リポジトリを開くと最初に出る。"},
        {"type": "single_choice", "q": "アカウント作成後、まず必ず設定すべき安全対策は？",
         "opts": s(1, "プロフィール画像", "2段階認証（2FA）", "リポジトリの色", "有料プラン"),
         "exp": "2FAは乗っ取り防止の基本。最初にオンにする。"},
        tf("Public（公開）リポジトリは、世界中の誰からでも見られる。", True,
           "○。見せたくないものは Private にする。"),
    ])

    lesson(sid, "第4回 ブラウザだけで作成・編集・コミット", L4, 4)
    lesson(sid, "第5回 GitHub Desktop でPCと同期（clone / commit / push）", L5, 5)
    lesson(sid, "第6回 Issues でやることを管理する", L6, 6)
    lesson(sid, "第7回 ブランチと Pull Request", L7, 7)
    quiz(sid, "理解度チェック② 実践（編集・同期・PR）", "第4〜7回の確認。", 8, [
        {"type": "single_choice", "q": "ブラウザでファイルの変更を保存・記録する操作は？",
         "opts": s(1, "Delete file", "Commit changes", "Sign out", "Clone"),
         "exp": "編集して下部の Commit changes でコミット＝保存して記録。"},
        {"type": "single_choice", "q": "GitHub Desktop で、クラウドのリポジトリを自分のPCに取り込むのは？",
         "opts": s(2, "Push", "Issue", "Clone", "Merge"),
         "exp": "Clone＝PCに取り込む。"},
        {"type": "single_choice", "q": "GitHub Desktop で、PCの変更をクラウドへ反映するのは？",
         "opts": s(0, "Push origin", "Fetch origin", "New issue", "Close"),
         "exp": "Commit to main（記録）→ Push origin（クラウドへ反映）。"},
        {"type": "single_choice", "q": "他の人やブラウザでの変更を自分のPCに取り込むのは？",
         "opts": s(3, "Push", "Commit", "New branch", "Pull（Fetch して Pull）"),
         "exp": "作業前に Pull しておくと衝突しにくい。"},
        {"type": "single_choice", "q": "Pull Request（PR）とは？",
         "opts": s(1, "リポジトリを削除する操作", "ブランチの変更を main に入れてもらう提案（レビュー→マージ）", "パスワードの再発行", "Issue を閉じる操作"),
         "exp": "PR＝変更の提案。差分が見え、レビューして Merge する。"},
        tf("ブランチは、main を壊さずに作業するためのコピーである。", True,
           "○。ブランチで試して、PRで main に取り込む。"),
    ])

    lesson(sid, "第8回 困ったとき＆安全ルール", L8, 9)
    quiz(sid, "理解度チェック③ 安全・トラブル", "第8回の確認。", 10, [
        {"type": "single_choice", "q": "GitHub に上げてはいけないものは？",
         "opts": s(2, "README", "画像ファイル", "パスワードや APIキー", "説明文"),
         "exp": "秘密情報は上げない。一度上げると履歴に残る。.gitignore で除外。"},
        {"type": "single_choice", "q": "コンフリクト（衝突）はどんなときに起きる？",
         "opts": s(1, "ログインしたとき", "同じ箇所を別々に変更したとき", "リポジトリを作ったとき", "READMEを書いたとき"),
         "exp": "同じ場所を別々に直すと衝突。作業前のPullで起きにくくなる。"},
        {"type": "single_choice", "q": "見せたくないコードを置くには？",
         "opts": s(0, "Private リポジトリにする／.gitignore で除外する", "Public にする", "コミットしない", "名前を変える"),
         "exp": "非公開は Private。アップロード自体を避けたいものは .gitignore。"},
        tf("コミットは小さく・こまめに分けるとよい（戻しやすく、原因も分かりやすい）。", True,
           "○。大きな一括コミットより、小さく積む方が安全。"),
    ])

    assignment(sid, "ハンズオン：自分のリポジトリを公開してみる",
               "学んだことを実際にやってみましょう。\n\n"
               "1. リポジトリを1つ作る（名前は自由）。\n"
               "2. README.md に『これは何か』を3行以上書く。\n"
               "3. ブラウザか GitHub Desktop で、ファイルを1つ追加してコミットする。\n"
               "4. （任意）Issue を1つ作ってみる。\n\n"
               "提出：作ったリポジトリのURL（Privateの場合はスクリーンショットでも可）と、やってみた感想・詰まった点を書いてください。", 11)

    for uid in MEMBERS:
        b.sb(env, "POST", "enrollments", {"user_id": uid, "course_id": c["id"], "status": "active"})
    print(f"受講登録: {len(MEMBERS)}名\n受講URL: /courses/{c['id']}\n完成 🎓")


if __name__ == "__main__":
    main()
