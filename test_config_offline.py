"""API キーなしで動く確認。Claude Code 設定サンプルの“正しさ”を検証する。

    python test_config_offline.py
"""

import ccarf_config as c


def main():
    S = c.SAMPLE

    # 1. 置き場所の範囲: プロジェクト直下は共有、~ 始まりは個人 [3.1][2.4]
    assert c.location_scope("CLAUDE.md") == "shared"
    assert c.location_scope("~/.claude.json") == "personal"
    assert c.location_scope("~/.claude/CLAUDE.md") == "personal"

    # 2. ルールは glob の paths を持ち、散らばったファイルに効く [3.3]
    tf = c.rule_paths(S[".claude/rules/terraform.md"])
    assert "**/*.tf" in tf
    assert c.rule_paths(S[".claude/rules/frontend.md"]) == ["apps/web/**"]

    # 3. スキルは独立コンテキストで動く（出力をメインに流さない）[3.2]
    sk = S[".claude/skills/analyze-codebase/SKILL.md"]
    assert c.skill_is_isolated(sk) is True

    # 4. スキルは使えるツールを制限している [3.2]
    assert c.skill_allowed_tools(sk) == ["Read", "Grep", "Glob"]

    # 5. 共有MCPは、生のトークンでなく環境変数展開でトークンを渡す [2.4]
    assert c.mcp_token_is_env(S[".mcp.json"]) is True
    leaky = '{"mcpServers":{"x":{"env":{"GITHUB_TOKEN":"ghp_abcdefghijklmnopqrstuvwxyz0123"}}}}'
    assert c.mcp_token_is_env(leaky) is False   # 生トークンの直書きは NG

    # 6. 個人用MCP(~/.claude.json)は共有されない [2.4]
    assert c.location_scope("~/.claude.json") == "personal"

    # 7. CLAUDE.md は @import で外部規約を取り込む [3.1]
    assert c.claude_md_has_import(S["CLAUDE.md"]) is True

    print("OK: 7 checks passed")


main()
