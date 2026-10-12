#!/usr/bin/env python3
"""CCAR-F 実装で理解する④（ccarf_config.py / test_config_offline.py 解説＋問題）。課題2=Claude Code設定。"""
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
    a = b.sb(env, "POST", "assignments", {"section_id": section_id, "title": title,
             "description": desc, "sort_order": order, "status": "published"})[0]
    print(f"  assignment[{order}] {title}  {a['id']}")


def quiz(section_id, title, desc, order, questions, passing=80, minutes=None):
    payload = {"section_id": section_id, "title": title, "description": desc,
               "passing_score": passing, "sort_order": order, "status": "published"}
    if minutes is not None:
        payload["time_limit_minutes"] = minutes
    q = b.sb(env, "POST", "quizzes", payload)[0]
    for qi, qq in enumerate(questions):
        qrow = b.sb(env, "POST", "quiz_questions", {"quiz_id": q["id"], "question_type": qq["type"],
                    "question_text": qq["q"], "explanation": qq.get("exp", ""), "sort_order": qi, "points": 1})[0]
        for oi, (text, correct) in enumerate(qq["opts"]):
            b.sb(env, "POST", "quiz_options", {"question_id": qrow["id"], "option_text": text,
                 "is_correct": correct, "sort_order": oi})
    print(f"  quiz[{order}] {title}  {q['id']}  ({len(questions)}問)")


def s(correct, *opts):
    return [(t, i == correct) for i, t in enumerate(opts)]


def tfq(q, correct_bool, exp):
    return {"type": "true_false", "q": q, "exp": exp,
            "opts": [("○（正しい）", correct_bool), ("×（間違い）", not correct_bool)]}


L0 = r"""この2ファイルは、**CCAR-F 練習課題2「チーム開発向けの Claude Code 設定」** の学習用サンプルです。前の3つ（エージェント・調査・抽出）は“動くプログラム”でしたが、課題2は**設定ファイルの置き場所と書き方**がテーマ。対応は分野3・2。

実際の `.claude/` を作ると誤って有効化してしまうので、サンプル設定は `ccarf_config.py` の中に**文字列で**持ち、正しさを検証する関数にしてあります。

## 設定の2系統（これが全体像）

| 系統 | 置き場所 | 効く範囲 |
|---|---|---|
| **共有**（プロジェクト） | リポジトリ内（`CLAUDE.md`, `.claude/...`, `.mcp.json`） | チーム全員。バージョン管理で配られる |
| **個人**（ユーザー） | ホーム（`~/.claude/...`, `~/.claude.json`） | 自分だけ。共有されない |

**覚え方：`~` で始まるものは個人用**。チームに効かせたい規約・ルール・スキル・MCPは、リポジトリ側に置きます。

## サンプルに含まれるファイル

| パス | 役割 |
|---|---|
| `CLAUDE.md` | 全員に常に効く規約（＋ `@import` で外部規約を取り込む）[3.1] |
| `.claude/rules/terraform.md` / `frontend.md` | glob で領域を絞ったルール [3.3] |
| `.claude/skills/analyze-codebase/SKILL.md` | `context: fork` と `allowed-tools` を使うスキル [3.2] |
| `.mcp.json` | 共有MCPサーバー（トークンは環境変数展開）[2.4] |
| `~/.claude.json` | 個人用・実験用MCPサーバー [2.4] |

## 検証（test_config_offline.py）

`python test_config_offline.py` → `OK: 7 checks passed`。置き場所の範囲・ルールの glob・スキルの隔離とツール制限・MCPのトークンの渡し方などを、決定的にチェックします。

次から、CLAUDE.md → ルール → スキル → MCP と plan mode の順に読みます。
"""

L1 = r"""## CLAUDE.md の階層

`CLAUDE.md` は、Claude に常に効かせる指示を書くファイル。**どこに置くかで、効く範囲が変わります** [3.1]。

| 置き場所 | 効く範囲 |
|---|---|
| リポジトリ直下 `CLAUDE.md` | プロジェクト全員（共有） |
| サブディレクトリの `CLAUDE.md` | そのディレクトリ配下 |
| `~/.claude/CLAUDE.md` | **自分だけ**（共有されない） |

**よくある事故**：チームの規約を、最初に環境を整えた人が `~/.claude/CLAUDE.md` に書いてしまう。すると**その人にしか効かず**、新メンバーは別の挙動になります。チームの規約は、必ず**プロジェクトレベル**に置いて共有します [3.1]。

`ccarf_config.py` では `location_scope(path)` が、`~` 始まりを `personal`、それ以外を `shared` と判定します。

## @import で外部規約を取り込む

規約が増えたら、CLAUDE.md 本体に全部書かず、別ファイルを取り込みます。

```markdown
# プロジェクト規約（全員に常に効く）
- 変数・関数は snake_case ...

@import docs/standards/python.md
@import docs/standards/typescript.md
```

モノレポで「パッケージごとに適用する規約を選びたい」ときは、各パッケージの CLAUDE.md から **必要な規約ファイルだけ `@import`** します（本文を複製すると、元が変わったときにズレる）[3.1]。

> まとめ：**共有はプロジェクト直下・個人は `~`**、**規約は `@import` で分割して取り込む** [3.1]。
"""

L2 = r"""## ルールファイル（.claude/rules/ ＋ paths の glob）

CLAUDE.md は**常に**読み込まれます。でも「Terraform のときだけ」「フロントのときだけ」効かせたい規約もあります。それが**ルールファイル** [3.3]。

```markdown
---
paths:
  - "**/*.tf"
  - "infra/**"
---
# Terraform 規約（.tf を編集するときだけ読み込む）
- module 名は snake_case ...
```

- `paths` に **glob** を書くと、**一致するファイルを編集するときだけ**そのルールが読み込まれます。
- 対象ファイルが**複数ディレクトリに散らばっていても**、glob 一発で効かせられます。各ディレクトリに同じ CLAUDE.md を置いて回る必要はありません（複製は保守が大変）[3.3]。

`ccarf_config.py` の `rule_paths(text)` が、この `paths` を取り出します（`terraform.md` は `["**/*.tf", "infra/**"]`、`frontend.md` は `["apps/web/**"]`）。

## CLAUDE.md とルールの使い分け

| 置き場所 | いつ読まれる | 向いている内容 |
|---|---|---|
| CLAUDE.md | 常に | 全員・全場面の共通規約 |
| `.claude/rules/*.md` ＋ paths | 一致ファイルの編集時 | 領域別（Terraform / フロント など）の規約 |

> まとめ：**常時＝CLAUDE.md、条件付き＝ルール（paths の glob）**。散らばった対象は glob で一発 [3.3]。
"""

L3 = r"""## スキル（.claude/skills/ の SKILL.md）

スキルは「必要なときに呼ぶ手順」。frontmatter の設定が3つ、試験で問われます [3.2]。

```markdown
---
name: analyze-codebase
description: コードベース全体を分析して構造と要点を要約する
context: fork
allowed-tools: [Read, Grep, Glob]
argument-hint: "[対象ディレクトリ]"
---
# コードベース分析
...手順...
```

- **`context: fork`** … スキルを**独立したサブエージェントのコンテキスト**で実行し、**大量の出力をメインの会話に流し込まない** [3.2]。コードベース全体分析のような“出力が多い”手順に効く。
- **`allowed-tools`** … スキル実行中に**使えるツールを制限**する（例: 読み取り系だけ）。書き込みや破壊的コマンドを誤って実行させない [3.2]。
- **`argument-hint`** … 引数なしで呼ばれたとき、**必要な入力を促す**。

`ccarf_config.py` では `skill_is_isolated(text)`（context==fork か）と `skill_allowed_tools(text)` で検証します。

## スキルも共有/個人がある

| 置き場所 | 範囲 |
|---|---|
| `.claude/skills/` | プロジェクト全員 |
| `~/.claude/skills/` | 自分だけ |

チーム共有のスキルを**自分だけ少し変えたい**ときは、プロジェクトのスキルを書き換えず、`~/.claude/skills/` に**別名で**自分版を作ります（全員に影響させない）。

> まとめ：**出力隔離＝context: fork**、**ツール制限＝allowed-tools**、**入力案内＝argument-hint**。個人版は `~/.claude/skills/` に別名で [3.2]。
"""

L4 = r"""## MCPサーバーの設定（共有と個人）[2.4]

| ファイル | 範囲 | 使いどころ |
|---|---|---|
| `.mcp.json`（リポジトリ内） | 全員で共有 | チーム共通のMCPサーバー |
| `~/.claude.json`（ホーム） | 自分だけ | 個人用・実験用 |

**チーム全員に同じMCPサーバーを使わせたい → `.mcp.json`**。ただし**認証トークンはコミットしたくない**。そこで**環境変数展開**で渡します。

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
    }
  }
}
```

- `"${GITHUB_TOKEN}"` と書けば、各自の環境変数から読み込まれ、**トークンそのものはリポジトリに入りません** [2.4]。
- 生のトークンを直書きしたり、`.mcp.json` を `.gitignore` に入れる（＝共有できない）のは誤り。

`ccarf_config.py` の `mcp_token_is_env(json_text)` は、**生のトークン（`ghp_...` など）が無く、`${...}` でトークンを渡しているか**を判定します。

## plan mode と直接実行の使い分け [3.4]

| 状況 | 選ぶもの |
|---|---|
| 多数のファイル・設計判断・複数の妥当な案 | **plan mode**（調査と設計をしてから変更） |
| 原因も範囲も明確な小さな修正 | **直接実行** |
| 調査の出力が多く、コンテキストが尽きる | **Explore サブエージェント** |

難易度の低い修正に plan mode を使うと過剰、難易度の高い変更を直接実行で始めると手戻りになります。

## 検証（test_config_offline.py）

7チェック：置き場所の範囲 / ルールの glob / スキルの隔離 / スキルのツール制限 / MCPのトークンは環境変数（生トークンはNG）/ `~/.claude.json` は個人 / CLAUDE.md の `@import`。`OK: 7 checks passed` を実機確認済み。

> まとめ：**共有MCPは `.mcp.json` ＋ `${VAR}`、個人は `~/.claude.json`** [2.4]。**難易度で plan mode と直接実行を使い分け** [3.4]。
"""

QUIZ = [
    {"type": "single_choice", "q": "CLAUDE.md をリポジトリ直下に置くと、効く範囲は？",
     "opts": s(1, "自分だけ", "プロジェクト全員（バージョン管理で共有される）", "そのファイルを開いたときだけ", "どこにも効かない"),
     "exp": "リポジトリに入るものは共有される。チームの共通規約はここに置く [3.1]。"},
    {"type": "single_choice", "q": "~/.claude/CLAUDE.md に書いた規約の効く範囲は？",
     "opts": s(1, "プロジェクト全員", "自分だけ（共有されない）", "同じ組織の全員", "読み込まれない"),
     "exp": "~ で始まるものは個人用。チームの規約をここに書くと本人にしか効かず、他メンバーは別挙動になる [3.1]。"},
    {"type": "single_choice", "q": "複数ディレクトリに散らばる .tf ファイルにだけ Terraform 規約を効かせるには？",
     "opts": s(1,
        "ルートの CLAUDE.md に書いて Claude の判断に任せる",
        ".claude/rules/ にルールを作り、frontmatter の paths に glob（例: **/*.tf）を書く",
        "各ディレクトリに同じ CLAUDE.md を置いて回る",
        "スキルにして毎回手動で呼ぶ"),
     "exp": "散らばった対象は paths の glob で一発。該当ファイルの編集時だけ読み込まれる [3.3]。"},
    {"type": "single_choice", "q": "CLAUDE.md と .claude/rules/（paths付き）の読み込まれ方の違いは？",
     "opts": s(0,
        "CLAUDE.md は常に、ルールは paths に一致するファイルを編集するときだけ",
        "両方とも常に読み込まれる",
        "両方とも手動で呼んだときだけ",
        "ルールは常に、CLAUDE.md は編集時だけ"),
     "exp": "常時＝CLAUDE.md、条件付き＝ルール（paths の glob）[3.3]。"},
    {"type": "single_choice", "q": "スキルの frontmatter の context: fork は何のため？",
     "opts": s(1,
        "スキルを高速化する",
        "独立したサブエージェントのコンテキストで実行し、大量の出力をメイン会話に流さない",
        "使えるツールを制限する",
        "引数を促す"),
     "exp": "出力の多い手順（コードベース全体分析など）の出力を隔離する [3.2]。"},
    {"type": "single_choice", "q": "スキルの allowed-tools は何を設定する？",
     "opts": s(1,
        "スキルの実行速度",
        "スキル実行中に使えるツールの制限（例: 読み取り系だけ）",
        "出力の隔離",
        "必要な引数"),
     "exp": "書き込みや破壊的コマンドを誤って実行させないための制限 [3.2]。"},
    {"type": "single_choice", "q": "引数なしでスキルが呼ばれたときに、必要な入力を促す frontmatter は？",
     "opts": s(2, "context: fork", "allowed-tools", "argument-hint", "paths"),
     "exp": "argument-hint。paths はルールファイルの設定で、スキルのものではない。"},
    {"type": "single_choice", "q": "チーム共有のスキルを、自分だけ少し変えて使いたい。正しい方法は？",
     "opts": s(1,
        "プロジェクトのスキルを書き換え、同僚には無視してもらう",
        "~/.claude/skills/ に別名で自分版を作る",
        "プロジェクトの CLAUDE.md に手順を書き足す",
        "context: fork を付ければ自分専用になる"),
     "exp": "プロジェクトのスキルを変えると全員に影響する。個人版は ~/.claude/skills/ に別名で作る [3.2]。"},
    {"type": "single_choice", "q": "チーム全員で共有するMCPサーバーを定義するファイルは？",
     "opts": s(0, ".mcp.json（リポジトリ内）", "~/.claude.json", "CLAUDE.md", ".gitignore"),
     "exp": ".mcp.json はリポジトリに入り共有される。~/.claude.json は個人用 [2.4]。"},
    {"type": "single_choice", "q": ".mcp.json で認証トークンをコミットせずに渡す正しい方法は？",
     "opts": s(1,
        "トークンを直接書く",
        "環境変数展開 ${GITHUB_TOKEN} で渡す",
        ".mcp.json を .gitignore に入れる",
        "CLAUDE.md にトークンを書く"),
     "exp": "${VAR} で各自の環境変数から読み込む。直書きは漏洩、.gitignore は共有できない [2.4]。"},
    {"type": "single_choice", "q": "~/.claude.json に定義したMCPサーバーの範囲は？",
     "opts": s(1, "チーム全員に自動共有", "自分だけ（共有されない・個人/実験用）", "同じ.tfを編集する人だけ", "読み込まれない"),
     "exp": "ユーザーレベルの設定で本人にしか効かない。共有するならプロジェクトの .mcp.json [2.4]。"},
    {"type": "single_choice", "q": "@import は何をする構文？",
     "opts": s(1,
        "MCPサーバーを起動する",
        "CLAUDE.md から外部の規約ファイルを取り込む",
        "スキルを呼び出す",
        "ルールの paths を指定する"),
     "exp": "規約を分割し、必要なものだけ取り込める。本文の複製より保守しやすい [3.1]。"},
    {"type": "single_choice", "q": "plan mode が最も向くのは？",
     "opts": s(1,
        "原因も範囲も明確な1行の修正",
        "多数のファイルに及び、設計判断や複数の妥当な案がある変更",
        "ログを1行追加するだけ",
        "タイプミスの修正"),
     "exp": "plan mode は調査と設計をしてから変更する。大規模・設計判断ありに向く [3.4]。"},
    {"type": "single_choice", "q": "直接実行が最も向くのは？",
     "opts": s(0,
        "原因も範囲も明確な小さな修正",
        "モノリスをマイクロサービスに再構成する",
        "どの戦略を取るか決まっていない移行",
        "数十ファイルに及ぶ変更"),
     "exp": "範囲が明確な小さな修正に調査や設計は過剰。直接実行でよい [3.4]。"},
    {"type": "single_choice", "q": "mcp_token_is_env が False（＝NG）を返すのはどんなとき？",
     "opts": s(1,
        "${GITHUB_TOKEN} で渡しているとき",
        "ghp_... のような生のトークンが直書きされているとき",
        "env が空のとき",
        "args に npx があるとき"),
     "exp": "生のトークンが埋まっている＝コミットで漏洩する設定なので NG。${VAR} で渡すのが正 [2.4]。"},
    tfq("~/.claude/CLAUDE.md に書いた規約は、バージョン管理を通じてチームに共有される。", False,
        "×。~ で始まるものは本人にしか効かず、共有されない。共有するならプロジェクトレベルに置く [3.1]。"),
    tfq("ルールファイルの paths に glob を書くと、一致するファイルを編集するときだけそのルールが読み込まれる。", True,
        "○。常時読まれる CLAUDE.md と違い、ルールは条件付き。散らばった対象に効かせられる [3.3]。"),
]

ASSIGN = r"""`ccarf_config.py` / `test_config_offline.py` を手元にコピーして取り組んでください（SDK不要・`python test_config_offline.py` がそのまま動きます）。

## 必須課題（どれか1つ以上）

**A. 領域別ルールを1つ足す**
`SAMPLE` に新しいルール（例 `.claude/rules/python.md`、paths: `["**/*.py"]`）を足し、`rule_paths` で正しく取り出せることを確認する [3.3]。

**B. スキルを1つ足す / 直す**
`context: fork` と `allowed-tools` を持つスキルを新設、または既存スキルの allowed-tools を変える。`skill_is_isolated` / `skill_allowed_tools` で検証する [3.2]。

**C. 設定の“置き間違い”を検出する関数を足す**
例: 「チーム規約が ~ 始まり（個人）に置かれていないか」「.mcp.json に生トークンが無いか」をまとめてチェックする `audit(SAMPLE)` を書く [3.1][2.4]。

## 検証（必須）

`test_config_offline.py` に、追加した機能のテストを**最低1つ**足して、`python test_config_offline.py` が `OK: N checks passed` で通ることを確認する。

## 提出するもの
1. 追加・変更したコード 2. `python test_config_offline.py` の結果 3. ひとこと：対応する試験項目（例 [3.1][3.2][3.3][2.4]）

## 評価の観点
- 共有/個人の置き場所を正しく選べているか [3.1][2.4]
- 散らばった対象に paths の glob で効かせられているか [3.3]
- スキルの隔離・ツール制限を正しく設定できているか [3.2]
- 追加に決定的なテストが付いているか
"""


def main():
    assert len(QUIZ) == 17
    c = b.sb(env, "POST", "courses", {
        "title": "CCAR-F 実装で理解する ④ ｜ Claude Code チーム設定",
        "description": "練習課題2の学習用サンプル（ccarf_config.py / test_config_offline.py）で、Claude Code のチーム設定を読み解くコース。CLAUDE.md の階層と @import、paths 付きルール、context: fork と allowed-tools のスキル、.mcp.json と ~/.claude.json（共有/個人）、plan mode と直接実行の使い分けを、試験の出題項目に結びつけて理解します。解説5本＋コード読解17問＋ハンズオン課題。検証スクリプト動作確認済み。",
        "status": "published", "is_sequential": False, "created_by": ADMIN_UUID})[0]
    print(f"講座作成: {c['id']}")
    sec1 = b.sb(env, "POST", "sections", {"course_id": c["id"], "title": "設定の解説", "sort_order": 0})[0]["id"]
    print(f"section1: {sec1}")
    lesson(sec1, "① このコースの全体像（共有と個人の2系統）", L0, 0)
    lesson(sec1, "② CLAUDE.md の階層と @import", L1, 1)
    lesson(sec1, "③ ルールファイル（paths の glob）", L2, 2)
    lesson(sec1, "④ スキル（context: fork / allowed-tools）", L3, 3)
    lesson(sec1, "⑤ MCP設定（共有/個人）と plan mode の使い分け", L4, 4)
    sec2 = b.sb(env, "POST", "sections", {"course_id": c["id"], "title": "理解度チェック", "sort_order": 1})[0]["id"]
    print(f"section2: {sec2}")
    quiz(sec2, "設定 読解クイズ 17問",
         "ccarf_config.py / test_config_offline.py と Claude Code の設定を理解できたか確認する。解説付き。", 0, QUIZ, passing=80)
    assignment(sec2, "ハンズオン：ルール or スキル or 監査関数を足してテストする", ASSIGN, 1)
    for uid in MEMBERS:
        b.sb(env, "POST", "enrollments", {"user_id": uid, "course_id": c["id"], "status": "active"})
    print(f"受講登録: {len(MEMBERS)}名\n受講URL: /courses/{c['id']}\n完成 🎓")


if __name__ == "__main__":
    main()
