"""CCAR-F 練習課題2: チーム開発向けの Claude Code 設定（学習用サンプル）

試験ガイド8章 Exercise 2。設定ファイルの“置き場所”と“書き方”を、サンプルとして文字列で持ち、
正しさを検証できる関数にしてある。対応する出題項目をコメントに [3.1] のように書いてある。

やること（ガイド8章・課題2）:
- プロジェクトレベルの CLAUDE.md を作る [3.1]
- globパターン付きのルールを領域別に作る [3.3]
- context: fork と allowed-tools を使ったスキルを作る [3.2]
- .mcp.json と ~/.claude.json の両方にMCPサーバーを設定する（共有/個人）[2.4]
- 難易度の違うタスクで plan mode と直接実行を比べる [3.4]

実行:
    python ccarf_config.py          # サンプルを検証して表示（モデル不要・決定的）
"""

import json
import re

# ---------------------------------------------------------------------------
# サンプルの設定ファイル群（キー＝配置パス、値＝中身）
# 実際の .claude/ を作って誤って有効化しないよう、文字列で持っている
# ---------------------------------------------------------------------------
SAMPLE: dict[str, str] = {
    # プロジェクト直下＝リポジトリで全員に共有される常時の規約 [3.1]
    "CLAUDE.md": """# プロジェクト規約（全員に常に効く）

- 変数・関数は snake_case、クラスは PascalCase。
- 外部通信は必ず lib/http 経由。直接 requests を使わない。
- コミットメッセージは「種別: 要約」の形。

# 言語別の規約は外部ファイルを取り込む
@import docs/standards/python.md
@import docs/standards/typescript.md
""",

    # 複数ディレクトリに散らばる対象に、glob で効かせるルール [3.3]
    ".claude/rules/terraform.md": """---
paths:
  - "**/*.tf"
  - "infra/**"
---
# Terraform 規約（.tf を編集するときだけ読み込む）

- module 名は snake_case。
- 変数は variables.tf にまとめ、説明を必ず書く。
- state はリモートバックエンド固定。ローカル state 禁止。
""",

    ".claude/rules/frontend.md": """---
paths:
  - "apps/web/**"
---
# フロントエンド規約（apps/web 配下だけ）

- コンポーネントは関数コンポーネント。
- 文言は i18n キー経由。直書き禁止。
""",

    # スキル: 独立コンテキストで実行し、使えるツールを絞る [3.2]
    ".claude/skills/analyze-codebase/SKILL.md": """---
name: analyze-codebase
description: コードベース全体を分析して構造と要点を要約する
context: fork
allowed-tools: [Read, Grep, Glob]
argument-hint: "[対象ディレクトリ]"
---
# コードベース分析

1. 対象ディレクトリの構造を把握する。
2. 主要なエントリポイントと依存を特定する。
3. 要点だけを要約して返す（詳細な出力はメイン会話に流さない）。
""",

    # 共有MCPサーバー。トークンは環境変数展開で渡し、コミットしない [2.4]
    ".mcp.json": json.dumps({
        "mcpServers": {
            "github": {
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-github"],
                "env": {"GITHUB_TOKEN": "${GITHUB_TOKEN}"},
            }
        }
    }, ensure_ascii=False, indent=2),

    # 個人用・実験用のMCPサーバー。共有されない [2.4]
    "~/.claude.json": json.dumps({
        "mcpServers": {
            "scratch": {"command": "node", "args": ["./my-experiment/server.js"]}
        }
    }, ensure_ascii=False, indent=2),
}


# ---------------------------------------------------------------------------
# 検証用の関数（決定的。モデルを介さない）
# ---------------------------------------------------------------------------
def location_scope(path: str) -> str:
    """設定ファイルの効く範囲を返す。~ で始まるものは個人用（共有されない）[3.1][2.4]。"""
    return "personal" if path.startswith("~") else "shared"


def parse_frontmatter(text: str) -> dict:
    """先頭の --- で囲まれた簡易フロントマターを辞書で返す（list は [a, b] 形式も対応）。"""
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not m:
        return {}
    data: dict = {}
    current_key = None
    for line in m.group(1).splitlines():
        if re.match(r"^\s*-\s+", line) and current_key:   # YAML のリスト要素
            data[current_key].append(line.strip()[2:].strip().strip('"'))
            continue
        mm = re.match(r"^(\w[\w-]*):\s*(.*)$", line)
        if not mm:
            continue
        key, val = mm.group(1), mm.group(2).strip()
        if val == "":                       # 次行以降がリスト
            data[key] = []
            current_key = key
        elif val.startswith("[") and val.endswith("]"):   # インラインのリスト
            data[key] = [x.strip().strip('"') for x in val[1:-1].split(",") if x.strip()]
            current_key = None
        else:
            data[key] = val.strip('"')
            current_key = None
    return data


def rule_paths(text: str) -> list[str]:
    """ルールファイルの paths（glob）を返す。空なら「常に読まれる」設定 [3.3]。"""
    return parse_frontmatter(text).get("paths", [])


def skill_is_isolated(text: str) -> bool:
    """スキルが独立コンテキストで動くか（context: fork）[3.2]。"""
    return parse_frontmatter(text).get("context") == "fork"


def skill_allowed_tools(text: str) -> list[str]:
    """スキルが使えるツールの制限 [3.2]。"""
    return parse_frontmatter(text).get("allowed-tools", [])


_SECRET_RE = re.compile(r"(ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})")


def mcp_token_is_env(json_text: str) -> bool:
    """MCP設定が、生のトークンでなく環境変数展開 ${VAR} でトークンを渡しているか [2.4]。"""
    if _SECRET_RE.search(json_text):     # 生のトークンが埋まっている＝NG
        return False
    return "${" in json_text             # ${VAR} 形式で渡している＝OK


def claude_md_has_import(text: str) -> bool:
    """CLAUDE.md が @import で外部規約を取り込んでいるか [3.1]。"""
    return "@import" in text


# plan mode と直接実行の使い分け（表データ）[3.4]
PLAN_VS_DIRECT = [
    ("多数のファイル・設計判断・複数の妥当な案", "plan mode"),
    ("原因も範囲も明確な小さな修正", "直接実行"),
    ("調査の出力が多く、コンテキストが尽きる", "Explore サブエージェント"),
]


def main() -> None:
    print("=== 置き場所の範囲 ===")
    for path in SAMPLE:
        print(f"  {location_scope(path):8} {path}")
    print("\n=== ルールの paths ===")
    for path, text in SAMPLE.items():
        if path.endswith(".md") and "/rules/" in path:
            print(f"  {path}: {rule_paths(text)}")
    print("\n=== スキル ===")
    sk = SAMPLE[".claude/skills/analyze-codebase/SKILL.md"]
    print(f"  isolated(context: fork)={skill_is_isolated(sk)}  allowed-tools={skill_allowed_tools(sk)}")
    print("\n=== MCP トークン ===")
    print(f"  .mcp.json env展開={mcp_token_is_env(SAMPLE['.mcp.json'])}")
    print("\n=== plan mode vs 直接実行 ===")
    for cond, pick in PLAN_VS_DIRECT:
        print(f"  {cond} → {pick}")


if __name__ == "__main__":
    main()
