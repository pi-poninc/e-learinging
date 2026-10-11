#!/usr/bin/env python3
"""CCAR-F 知識固め＆直前対策コースを一括作成する（模擬問題集とは別コース）。

セクション1「知識固めドリル」:
  quiz ○×ドリル 35問 / quiz 用語ドリル 22問 / quiz 応用ドリル 12問（英語）
セクション2「直前対策」:
  lesson 暗記シート / lesson 見分け方・英語の読み方 / quiz 最難関15問 / lesson 試験当日までの進め方
＋ 管理者・南條・小中 を受講登録

出典: ユーザー作成 docx（直前対策パック／第3弾 知識固めドリル, @seiyakitazume 2026-10-11）。
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ADMIN_UUID = "bab3dae7-813b-43ee-b7f9-200ca779dcfd"
MEMBERS = [ADMIN_UUID,
           "8936dff0-704d-4d2f-bff0-c84869eec0fc",   # 南條 健人
           "fd11370b-58d9-4d8c-b95b-bdd851515f34"]   # 小中
sys.path.insert(0, str(ROOT / "content"))
import build as b  # noqa: E402

env = b.load_env()


def lesson(section_id, title, body, order):
    le = b.sb(env, "POST", "lessons", {
        "section_id": section_id, "title": title, "body": body,
        "sort_order": order, "status": "published"})[0]
    print(f"  lesson[{order}] {title}  {le['id']}")
    return le["id"]


def quiz(section_id, title, desc, order, questions, passing=80, minutes=None):
    payload = {"section_id": section_id, "title": title, "description": desc,
               "passing_score": passing, "sort_order": order, "status": "published"}
    if minutes is not None:
        payload["time_limit_minutes"] = minutes
    q = b.sb(env, "POST", "quizzes", payload)[0]
    for qi, qq in enumerate(questions):
        qrow = b.sb(env, "POST", "quiz_questions", {
            "quiz_id": q["id"], "question_type": qq["type"],
            "question_text": qq["q"], "explanation": qq.get("exp", ""),
            "sort_order": qi, "points": 1})[0]
        for oi, (text, correct) in enumerate(qq["opts"]):
            b.sb(env, "POST", "quiz_options", {
                "question_id": qrow["id"], "option_text": text,
                "is_correct": correct, "sort_order": oi})
    print(f"  quiz[{order}] {title}  {q['id']}  ({len(questions)}問)")
    return q["id"]


def s(correct, *opts):
    return [(t, i == correct) for i, t in enumerate(opts)]


def m(cset, *opts):
    return [(t, i in cset) for i, t in enumerate(opts)]


def tf(correct_bool, exp):
    return {"type": "true_false",
            "opts": [("○（正しい）", correct_bool), ("×（間違い）", not correct_bool)],
            "exp": exp}


def tfq(q, correct_bool, exp):
    d = tf(correct_bool, exp)
    d["q"] = q
    return d


# ===== Part A ○×ドリル 35問 =====
QA = [
    tfq('stop_reason が "end_turn" のときは、ツールを実行して次の反復へ進む。', False,
        '×。"end_turn" は終了。継続するのは "tool_use" のとき。'),
    tfq("サブエージェントは、親であるコーディネーターの会話履歴を自動的に引き継ぐ。", False,
        "×。引き継がない。必要な情報はプロンプトに明示して渡す。"),
    tfq('コーディネーターがサブエージェントを起動するには、allowedTools に "Task" が含まれている必要がある。', True,
        "○。委任には Task ツールが要る。"),
    tfq("サブエージェントを並列に実行するには、ターンを分けて Task を1つずつ呼び出す。", False,
        "×。1回の応答の中で、複数の Task 呼び出しを出す。"),
    tfq("PostToolUse フックは、ツールの結果をモデルが処理する前に変換できる。", True,
        "○。形式の統一などに使える。"),
    tfq("反復回数の上限を、ループの主な停止手段にするのが推奨される。", False,
        "×。避けるべき実装。停止は stop_reason で判定する。"),
    tfq("fork_session は、共通の分析結果から独立した枝を作るために使う。", True,
        "○。同じ分析から別案を試す分岐。"),
    tfq("以前のツール結果が古くなっていても、新しいセッションを始めるより再開するほうが常に確実である。", False,
        "×。ツール結果が古いときは、構造化した要約を渡して新しく始めるほうが確実。"),
    tfq("金銭操作の前の本人確認は、システムプロンプトに明記すれば確実に守られる。", False,
        "×。プロンプトの指示は失敗率がゼロにならない。コードで強制する。"),
    tfq("ツールの説明文は、モデルがツールを選ぶときの主な手がかりである。", True,
        "○。だから説明文の書き分けが効く。"),
    tfq("エージェントに与えるツールが多いほど、ツール選択の信頼性は上がる。", False,
        "×。多すぎると信頼性が下がる。役割に必要な数個に絞る。"),
    tfq('tool_choice: "any" は、名前を指定した特定のツールを必ず呼ばせる設定である。', False,
        '×。それは強制指定の説明。"any" は必ずどれかを呼ばせ、選択はモデルに任せる。'),
    tfq(".mcp.json に定義したMCPサーバーは、プロジェクトのメンバー全員で共有される。", True,
        "○。リポジトリに入る共有設定。"),
    tfq("~/.claude.json に定義したMCPサーバーは、チーム全員に自動で共有される。", False,
        "×。ユーザーレベルの設定で、本人にしか効かない。"),
    tfq("設定した複数のMCPサーバーのツールは、同時に利用できる。", True,
        "○。複数サーバーのツールを併用できる。"),
    tfq("MCPリソースは、何があるかを知るための探索的なツール呼び出しを減らすのに役立つ。", True,
        "○。階層やスキーマを公開して探索を減らす。"),
    tfq("Glob は、ファイルの中身を検索するためのツールである。", False,
        "×。中身の検索は Grep。Glob はファイルパスのパターン照合。"),
    tfq("Edit は、一意に特定できるテキストを目印にして部分的に修正する。", True,
        "○。重複する目印では失敗する。"),
    tfq("~/.claude/CLAUDE.md に書いた指示は、バージョン管理を通じてチームに共有される。", False,
        "×。本人にしか効かず、共有されない。共有するならプロジェクトレベルに置く。"),
    tfq(".claude/rules/ のルールに paths を書くと、一致するファイルを編集するときだけ読み込まれる。", True,
        "○。散らばったファイルに効く。"),
    tfq("context: fork を付けたスキルは、出力をメインの会話に流し込まずに実行できる。", True,
        "○。独立コンテキストで実行。"),
    tfq("plan mode は、原因が明確な単一ファイルのバグ修正に最も向いている。", False,
        "×。それは直接実行が向く場面。plan mode は大規模な変更や設計判断に向く。"),
    tfq("CIで Claude Code を実行するとき、-p を付けないと入力待ちで止まることがある。", True,
        "○。-p（非対話）が要る。"),
    tfq("コードを生成したセッションは、そのコードのレビューに最も適している。", False,
        "×。生成時の文脈を引きずるので向かない。独立したインスタンスが有効。"),
    tfq("「確信度の高い問題だけを報告すること」という指示は、具体的な報告基準と同じくらい精度を上げる。", False,
        "×。一般的な指示は、具体的な基準ほど精度を上げない。"),
    tfq("tool_use とJSONスキーマを使えば、明細の合計が総額と合わないといった意味上の誤りも防げる。", False,
        "×。防げるのは構文エラーだけ。意味上の誤りは別に検証する。"),
    tfq("必須項目にした情報が文書にないと、モデルが値を捏造して埋めることがある。", True,
        "○。だから任意（nullable）にする。"),
    tfq("必要な情報が文書にない場合でも、検証エラーを添えて再試行すれば解決できる。", False,
        "×。情報がないときは再試行が効かない。効くのは形式や構造の誤り。"),
    tfq("Message Batches API は費用が50%安く、処理には最大24時間かかる。", True,
        "○。遅延の保証はない。"),
    tfq("Message Batches API では、1つのリクエストの中でツールを実行して結果を返す複数ターンのやりとりができる。", False,
        "×。できない。リクエストの途中でツールを実行して結果を返すことはできない。"),
    tfq("顧客が人の担当者を明確に求めたら、まず問題を調査してから引き継ぐ。", False,
        "×。調査を挟まず、直ちに引き継ぐ。"),
    tfq("顧客の感情の分析は、案件の複雑さを測る信頼できる指標である。", False,
        "×。信頼できない。感情は複雑さと相関しない。"),
    tfq("検索が成功して該当が0件だった場合は、エラーとしてコーディネーターに報告する。", False,
        "×。正常な結果として報告する。エラーはアクセスに失敗したとき。"),
    tfq("全体の精度が十分に高ければ、文書の種類別や項目別の精度確認は省いてよい。", False,
        "×。全体の精度は、特定の種類や項目の弱さを隠すことがある。"),
    tfq("信頼できる情報源同士で統計が食い違うときは、出典を付けて両方を残す。", True,
        "○。時期の違いは変化の可能性。"),
]

# ===== Part B 用語ドリル 22問（穴埋め→選択式）=====
QB = [
    {"type": "single_choice", "q": "【用語①】エージェントループを継続すべきことを示す stop_reason の値は？",
     "opts": s(0, 'tool_use', 'continue_turn', 'running', 'end_turn'),
     "exp": '正解 "tool_use"。"end_turn" は終了。'},
    {"type": "single_choice", "q": "【用語②】コーディネーターがサブエージェントを起動するために使うツールの名前は？",
     "opts": s(0, "Task", "Spawn", "Delegate", "Subagent"),
     "exp": "正解 Task。委任には allowedTools に Task が要る。"},
    {"type": "single_choice", "q": "【用語③】サブエージェントの種類ごとに、説明・システムプロンプト・ツール制限を設定するものは？",
     "opts": s(0, "AgentDefinition", "SubagentConfig", "AgentProfile", "AgentSpec"),
     "exp": "正解 AgentDefinition。"},
    {"type": "single_choice", "q": "【用語④】ツールの結果を、モデルが処理する前に変換できるフックの名前は？",
     "opts": s(0, "PostToolUse", "PreToolUse", "PreResponse", "ToolResultFilter"),
     "exp": "正解 PostToolUse。ツール結果をモデルが見る前に変換する。"},
    {"type": "single_choice", "q": "【用語⑤】MCPツールが失敗をエージェントに伝えるためのフラグは？",
     "opts": s(0, "isError", "hasFailed", "errorFlag", "isFailure"),
     "exp": "正解 isError。種類と再試行可否は errorCategory・isRetryable。"},
    {"type": "single_choice", "q": "【用語⑥】必ずいずれかのツールを呼ばせ、どれを呼ぶかはモデルに任せる tool_choice の値は？",
     "opts": s(0, '"any"', '"auto"', '"required"', '"tool"'),
     "exp": '正解 "any"。"auto" はテキストで返す余地が残る。'},
    {"type": "single_choice", "q": "【用語⑦】Message Batches API で、リクエストと結果を突き合わせるための項目は？",
     "opts": s(0, "custom_id", "request_id", "batch_key", "correlation_id"),
     "exp": "正解 custom_id。"},
    {"type": "single_choice", "q": "【用語⑧】名前を付けた過去のセッションを再開するフラグは？",
     "opts": s(0, "--resume <session-name>", "--restore <session-name>", "--continue <session-name>", "--session <name>"),
     "exp": "正解 --resume <session-name>。"},
    {"type": "single_choice", "q": "【用語⑨】チームで共有するMCPサーバーを定義するファイルは？",
     "opts": s(0, ".mcp.json", "~/.claude.json", "mcp.config.json", ".claude/mcp.json"),
     "exp": "正解 .mcp.json。~/.claude.json は個人用。"},
    {"type": "single_choice", "q": "【用語⑩】.mcp.json で認証トークンをコミットせずに渡すための仕組みは？",
     "opts": s(0, "環境変数展開（例: ${GITHUB_TOKEN}）", "トークンを直接書く", ".gitignore に追加する", "別のシークレットファイルを絶対パスで指定する"),
     "exp": "正解 環境変数展開 ${GITHUB_TOKEN}。"},
    {"type": "single_choice", "q": "【用語⑪】ファイル名や拡張子のパターンでファイルを探す組み込みツールは？",
     "opts": s(0, "Glob", "Grep", "Find", "Search"),
     "exp": "正解 Glob。中身の検索は Grep。"},
    {"type": "single_choice", "q": "【用語⑫】CLAUDE.md から外部ファイルを取り込む構文は？",
     "opts": s(0, "@import", "@include", "#import", "{{import}}"),
     "exp": "正解 @import。"},
    {"type": "single_choice", "q": "【用語⑬】読み込まれているメモリファイルを確認するコマンドは？",
     "opts": s(0, "/memory", "/context", "/files", "/memories"),
     "exp": "正解 /memory。"},
    {"type": "single_choice", "q": "【用語⑭】スキルを独立したサブエージェントのコンテキストで実行する frontmatter の設定は？",
     "opts": s(0, "context: fork", "context: isolated", "run: subagent", "isolation: true"),
     "exp": "正解 context: fork。"},
    {"type": "single_choice", "q": "【用語⑮】スキルの実行中に使えるツールを制限する frontmatter の設定は？",
     "opts": s(0, "allowed-tools", "tools", "permitted-tools", "tool-scope"),
     "exp": "正解 allowed-tools。"},
    {"type": "single_choice", "q": "【用語⑯】引数なしでスキルが呼ばれたときに、必要な入力を促す frontmatter の設定は？",
     "opts": s(0, "argument-hint", "arg-prompt", "input-hint", "usage"),
     "exp": "正解 argument-hint。"},
    {"type": "single_choice", "q": "【用語⑰】Claude Code を非対話モードで実行するフラグ（短い形と長い形）は？",
     "opts": s(0, "-p と --print", "-q と --quiet", "-n と --non-interactive", "-b と --batch"),
     "exp": "正解 -p と --print。CIで入力待ちを防ぐ。"},
    {"type": "single_choice", "q": "【用語⑱】CIで機械処理できる構造化出力を強制する2つのフラグは？",
     "opts": s(0, "--output-format json と --json-schema", "--json と --schema", "--format json と --strict", "--structured と --schema-file"),
     "exp": "正解 --output-format json と --json-schema。"},
    {"type": "single_choice", "q": "【用語⑲】冗長な調査の出力を隔離し、要約だけを返すサブエージェントの名前は？",
     "opts": s(0, "Explore", "Research", "Scout", "Survey"),
     "exp": "正解 Explore。"},
    {"type": "single_choice", "q": "【用語⑳】長い入力で、冒頭と末尾は処理されるが中ほどの内容が抜け落ちる現象の呼び名は？",
     "opts": s(0, "lost in the middle", "context overflow", "middle truncation", "attention decay"),
     "exp": "正解 lost in the middle。要点を冒頭に置き、見出しで整理する。"},
    {"type": "single_choice", "q": "【用語㉑】金額・日付・注文番号などを要約の外に保持するブロックの呼び名は？",
     "opts": s(0, "case facts（ブロック）", "context block", "summary block", "memory block"),
     "exp": "正解 case facts。要約で劣化させない。"},
    {"type": "single_choice", "q": "【用語㉒】開発者に却下された指摘の傾向を分析するために、各指摘に持たせる欄の名前は？",
     "opts": s(0, "detected_pattern", "dismissal_reason", "finding_category", "confidence_score"),
     "exp": "正解 detected_pattern。"},
]

# ===== Part C 応用ドリル 12問（英語）=====
QC = [
    {"type": "single_choice", "q": "C1. Two web search subagents research the same topic in parallel. Their results overlap heavily, and other areas of the topic are left uncovered. What should the coordinator change?",
     "opts": s(1,
        "Run the two subagents one after the other instead of in parallel.",
        "Assign each subagent a distinct subtopic or source type.",
        "Add a third subagent with the same instructions.",
        "Ask the synthesis agent to remove duplicates."),
     "exp": "正解B。結果が重複し抜けもある。サブトピックや情報源の種類で担当を分ける。A: 順番を変えても重複は残る。C: 重複が増える。D: 重複は消せても抜けは埋まらない。"},
    {"type": "single_choice", "q": 'C2. After you added the line "Always analyze documents thoroughly" to the system prompt, the agent began calling analyze_document on web search results, which should go to extract_web_results. Both tool descriptions are detailed and unchanged. What is the most likely cause?',
     "opts": s(3,
        "The tool descriptions are too short.",
        "The agent has too many tools.",
        'tool_choice is set to "any".',
        "The wording of the new system prompt line creates an unintended association with the analyze_document tool."),
     "exp": "正解D。1行足した後から誤ったツールが選ばれる。説明は変わっていないので、原因は新しい文言と特定ツールの意図しない結びつき。A: 説明は詳しいと問題文にある。B・C: 変更の前後で変わっていない。"},
    {"type": "single_choice", "q": "C3. One generic tool, analyze_document, is used to extract data points, to summarize content, and to check claims against a source. Its outputs vary in shape, and the agent often uses it for the wrong purpose. Which redesign is best?",
     "opts": s(0,
        "Split it into purpose-specific tools with defined inputs and outputs (extract_data_points, summarize_content, verify_claim_against_source).",
        "Add a mode parameter that accepts any free-text instruction.",
        'Keep the tool and add "use carefully" to its description.',
        "Remove the tool and let the agent do everything in plain text."),
     "exp": "正解A。1つの汎用ツールが3用途に使われ出力がばらつく。入出力の決まった目的別ツールに分ける。B: 自由記述のモードは曖昧さを増やす。C: 曖昧な注意書きは効かない。D: 構造化出力を失う。"},
    {"type": "single_choice", "q": "C4. You need to find every usage of a function that is re-exported through several wrapper modules under different names. Searching for the original name finds only a few usages. What is the best approach?",
     "opts": s(2,
        "Read every file in the repository.",
        "Search for the original function name again with a case-insensitive pattern.",
        "First identify all the names under which the function is exported, then search for each name across the codebase.",
        'Use Glob to list all files that contain the word "wrapper" in their names.'),
     "exp": "正解C。別名で再エクスポートされた利用箇所。まず全ての名前を洗い出し、それぞれを検索。A: コンテキストを使い切る。B: 別名は見つからない。D: ファイル名ではなく中身の名前の問題。"},
    {"type": "single_choice", "q": "C5. Developers often invoke your team's /migrate skill without the required table name, and the skill then fails. Which frontmatter option addresses this?",
     "opts": s(1, "context: fork", "argument-hint", "allowed-tools", "paths"),
     "exp": "正解B。必要な引数なしで呼ばれる。argument-hint で入力を促す。A: コンテキストの分離。C: ツール制限。D: ルールファイルの設定。"},
    {"type": "single_choice", "q": "C6. A skill is meant only to write a report file. During one run it executed a destructive shell command. Which frontmatter option prevents this?",
     "opts": s(0,
        "allowed-tools, restricting the skill to file write operations.",
        "argument-hint",
        "context: fork",
        'A sentence in the skill body saying "do not run dangerous commands".'),
     "exp": "正解A。allowed-tools で使えるツールを制限する。B: 引数の案内。C: 分離しても実行は防げない。D: 文章での禁止は確率的。"},
    {"type": "single_choice", "q": "C7. You are about to implement a caching layer in a domain you do not know well. In past projects you discovered important considerations (invalidation strategy, failure modes) only after the code was written. Which technique helps most before implementation?",
     "opts": s(3,
        "Ask Claude to write the code quickly and review it afterward.",
        "Provide two input/output examples.",
        "Run the implementation three times and compare the results.",
        "Have Claude ask you questions first to surface considerations you may not have anticipated."),
     "exp": "正解D。不慣れな領域で実装後に考慮漏れ。実装前に質問させて洗い出す。A: 同じ失敗を繰り返す。B: 入出力例は変換仕様を伝える技法で設計上の考慮点は出ない。C: 3回とも漏れる。"},
    {"type": "single_choice", "q": "C8. You are building a parser with many edge cases and want steady, measurable improvement over several iterations. Which workflow is best?",
     "opts": s(2,
        "Describe all the edge cases in one long paragraph and ask for a perfect implementation.",
        "Ask Claude to self-assess the quality of the parser after each change.",
        "Write a test suite covering expected behavior and edge cases first, then iterate by sharing the test failures.",
        "Review the parser manually after each change and describe the problems from memory."),
     "exp": "正解C。先にテストを書き、失敗結果を共有しながら直す。A: 一度に完璧は得にくく進み具合も測れない。B: 自己評価は客観的基準にならない。D: 記憶頼みで抜けが出る。"},
    {"type": "single_choice", "q": "C9. Source documents write dates and units in many different ways. Your extraction uses a strict JSON schema, so the output is always valid JSON, but the values are formatted inconsistently. What should you add?",
     "opts": s(1,
        "More required fields in the schema.",
        "Format normalization rules in the prompt, alongside the schema.",
        "A larger max_tokens value.",
        'tool_choice: "auto".'),
     "exp": "正解B。JSONは正しいが日付や単位の書式がそろわない。スキーマに加えてプロンプトで正規化ルールを指定。A: 項目を増やしても書式はそろわない。C: 長さは無関係。D: ツールを呼ばない余地が生まれるだけ。"},
    {"type": "multiple_choice", "q": "C10. A synthesis agent has a limited context budget. Upstream subagents send it long passages of raw content together with their full reasoning. Which TWO changes help most? (Select TWO.)",
     "opts": m({0, 1},
        "Have upstream agents return structured data such as key facts, citations, and relevance scores.",
        "Require upstream agents to include metadata such as dates and source locations in their structured output.",
        "Have upstream agents send their full reasoning twice for emphasis.",
        "Remove all citations to save space.",
        "Let the synthesis agent ignore every second input."),
     "exp": "正解A・B。統合側のコンテキストが限られる。上流には要点・引用・関連度の構造化データを返させ、日付や出典の場所も含めさせる。C: さらにコンテキストを使う。D: 出典を失う。E: 情報を無作為に捨てる。"},
    {"type": "single_choice", "q": "C11. One of four sources was unavailable during a research run. The system still produced a confident report with no mention of the missing source. How should the output change?",
     "opts": s(3,
        "Cancel the report whenever any source is unavailable.",
        "Fill the gap with the model's general knowledge without marking it.",
        "Repeat the available findings to make the report look complete.",
        "Annotate the report to show which findings are well supported and which topic areas have gaps because a source was unavailable."),
     "exp": "正解D。裏付けのある部分と、抜けのある部分を注記する。A: 1つの失敗で全体を止めるのは誤り。B: 出典のない内容が混ざる。C: 抜けを隠している。"},
    {"type": "single_choice", "q": "C12. To save time, a teammate proposes letting subagents send results directly to each other instead of through the coordinator. What is the main reason to keep communication routed through the coordinator?",
     "opts": s(0,
        "It preserves observability, consistent error handling, and controlled information flow.",
        "Subagents are technically unable to produce output.",
        "Direct communication always doubles the cost.",
        "The coordinator needs the traffic to stay within its rate limits."),
     "exp": "正解A。コーディネーター経由にする理由は、可観測性・一貫したエラー処理・情報の流れの制御。B・C・D: いずれも事実ではない。"},
]

# ===== 最難関15問 =====
QH = [
    {"type": "single_choice", "q": "H1. Yesterday you used a named session to analyze 30 files in a service. Since then, a teammate changed 2 of those files. The rest of your analysis is still valid. What is the best way to continue?",
     "opts": s(0,
        "Resume the session with --resume and tell the agent which 2 files changed so it can re-analyze them.",
        "Start a new session and inject a structured summary of yesterday's findings.",
        "Resume the session with --resume and continue without mentioning the changes.",
        "Use fork_session to create a new branch from yesterday's session."),
     "exp": "正解A。30中2ファイルだけ変わり残りは有効。再開して変更点を伝え、その部分だけ再分析。B: 大半が変わってツール結果が古いときの正解。今回は作り直す必要がない。C: 古い前提のまま進む。"},
    {"type": "single_choice", "q": "H2. Your team has a 12-step procedure for writing release notes. It is used about once a month and is irrelevant to everyday coding. Where should this procedure live?",
     "opts": s(2,
        "In the project CLAUDE.md, so it is always available.",
        "In a .claude/rules/ file with a paths pattern for the changelog file.",
        "In a project skill in .claude/skills/, invoked when it is needed.",
        "In each developer's ~/.claude/CLAUDE.md."),
     "exp": "正解C。月1回・日常と無関係な12ステップ。必要なときに呼ぶスキルが合う。A: 全員に常に効かせたい共通規約なら正解だが、常時読み込むとコンテキストの無駄。"},
    {"type": "single_choice", "q": "H3. Your support agent should open each conversation with a warm greeting. In about 5% of conversations it skips the greeting. No policy or financial risk is involved. What is the proportionate fix?",
     "opts": s(1,
        "Add a hook that blocks any first response that lacks a greeting.",
        "State the expectation clearly in the system prompt and add an example of a good opening.",
        "Deploy a separate classifier that checks every response for a greeting.",
        "Escalate conversations in which the agent skipped the greeting."),
     "exp": "正解B。挨拶の抜けは金銭・ポリシーのリスクなし。プロンプトと例で足りる。A: 違反が1件でも許されない規則ならフックが正解。今回は『リスクなし』なので強制は過剰。"},
    {"type": "single_choice", "q": 'H4. A support agent answers general questions in plain text and calls tools only when it needs account data. After a configuration change, it calls a tool on every turn, even for "thank you". Which tool_choice setting is appropriate for this agent?',
     "opts": s(3,
        '"any"',
        "Forced selection of get_customer",
        "Forced selection of escalate_to_human",
        '"auto"'),
     "exp": '正解D。文章で答える場合とツールを使う場合の両方がある。"auto" が合う。A: 必ず構造化出力がほしい抽出なら "any" が正解。今回は会話の返答も必要なので毎回ツールを呼ばせると壊れる。'},
    {"type": "single_choice", "q": 'H5. A compliance audit runs once a week. When an auditor starts it, the results must be ready within 2 hours. A teammate suggests the Message Batches API because the job is "weekly and not real-time". What should you choose?',
     "opts": s(0,
        "The synchronous API, because batch processing has no guaranteed completion time within the required window.",
        "The Message Batches API, because weekly jobs are latency-tolerant.",
        "The Message Batches API with a custom_id on each request to speed up processing.",
        "The Message Batches API, polling every minute so results arrive within 2 hours."),
     "exp": "正解A。週1回でも開始から2時間以内に必要。バッチは最大24時間で完了時間の保証がない。B: 『週次』に引っ張られる。判断基準は頻度でなく、いつまでに結果が必要か。"},
    {"type": "single_choice", "q": "H6. An extraction fails schema validation because the model returned the invoice date as 03/04/2026 while the schema requires ISO 8601. The date is clearly printed in the document. What is the best next step?",
     "opts": s(2,
        "Route the document to human review.",
        "Make the date field optional so validation passes.",
        "Send a follow-up request that includes the document, the failed extraction, and the specific validation error.",
        "Resubmit the same request unchanged."),
     "exp": "正解C。日付は文書にあり形式だけが違う。検証エラーを添えた再試行で直る。A: 情報が文書にないときは人に回すのが正解。今回は形式の誤りなので再試行が効く。B: 必要な値を落とす。"},
    {"type": "single_choice", "q": "H7. A customer wants to return three items from one order: one damaged, one unwanted, one arrived late. The request takes many steps, but your return policy clearly covers each of the three situations. What should the agent do?",
     "opts": s(1,
        "Escalate, because the case is complex.",
        "Resolve the case itself by applying the policy to each item.",
        "Ask the model for a confidence score and escalate if it is below 8 out of 10.",
        "Process only the damaged item and escalate the other two."),
     "exp": "正解B。手順は多いがポリシーが3状況を明確に定めている。複雑さだけでは引き継がない。A: ポリシーに定めがない/人を求めた/進展できないのどれかなら正解。今回はどれにも当たらない。"},
    {"type": "single_choice", "q": "H8. A web search subagent receives a 503 error from the search service. This kind of error usually clears within seconds. What should the subagent do?",
     "opts": s(3,
        "Return an empty result set to the coordinator.",
        "Immediately return structured error context to the coordinator without retrying.",
        "Raise an exception that stops the whole research workflow.",
        "Retry locally; if it still fails, return structured error context with what was attempted and any partial results."),
     "exp": "正解D。すぐ解消する一時的エラー。まず自分で再試行し、だめなら試した内容と途中結果を添えて上げる。B: 構造化エラーを返すこと自体は正しいが、一時的な失敗は上げる前に回復を試みる。"},
    {"type": "single_choice", "q": "H9. A document search subagent runs a query. The search service responds successfully and reports zero matching documents. The subagent retries five times and then reports a failure to the coordinator. What should change?",
     "opts": s(0,
        "Treat the response as a valid empty result and report it as a successful search with no matches.",
        "Increase the number of retries to ten.",
        "Report the failure with structured error context.",
        "Have the coordinator stop the workflow when no documents are found."),
     "exp": "正解A。検索は成功し0件＝正常な結果で失敗ではない。C: アクセス失敗なら構造化エラーが正解。今回は『成功して0件』なのでエラー扱い自体が誤り。"},
    {"type": "single_choice", "q": "H10. You must migrate a logging library that is used in 45 files. Several migration strategies are possible. Which workflow is best?",
     "opts": s(2,
        "Use direct execution from the start and fix problems as they appear.",
        "Stay in plan mode for the whole task, including the code changes.",
        "Use plan mode to investigate and choose a strategy, then use direct execution to implement the plan.",
        "Ask Claude to migrate all 45 files in one prompt without exploring first."),
     "exp": "正解C。45ファイル・複数戦略。plan mode で調べて決め、直接実行で実装。B: 調査と設計には plan mode が正解だが、そのままでは変更を進められない。"},
    {"type": "single_choice", "q": 'H11. Your tools already have detailed, clearly differentiated descriptions. For genuinely ambiguous requests such as "check on my thing from last week", the agent still picks different tools on different runs. What is the most effective next step?',
     "opts": s(1,
        "Rewrite the tool descriptions again with even more detail.",
        "Add 2 to 4 few-shot examples of ambiguous requests that show the reasoning for the chosen action.",
        "Merge all the tools into one tool.",
        "Force a single tool with tool_choice for every request."),
     "exp": "正解B。説明は十分。残る原因は曖昧な依頼での判断のぶれなので、理由つき few-shot が効く。A: 説明が最小限なら書き足しが正解だが、今回は『すでに詳しい』。"},
    {"type": "single_choice", "q": 'H12. Your pipeline asks Claude to "respond in JSON" in plain text and then parses the reply. About 3% of replies fail to parse because of missing brackets or trailing text. What is the most reliable fix?',
     "opts": s(3,
        'Add "return valid JSON only" to the prompt in stronger wording.',
        "Retry each failed reply up to five times.",
        "Add few-shot examples of valid JSON.",
        "Define an extraction tool with a JSON schema and read the structured data from the tool_use response."),
     "exp": "正解D。平文でJSONを頼むと構文エラーが出る。tool_use とスキーマで構文エラーをなくす。C: few-shot は形式をそろえるが構文の保証にならない。『most reliable』なので保証できる方法を選ぶ。"},
    {"type": "single_choice", "q": "H13. Which statement about confidence scores is accurate?",
     "opts": s(0,
        "Field-level confidence scores, calibrated with a labeled validation set, can be used to route extractions to human review.",
        "A support agent's self-reported confidence is a reliable trigger for escalating complex cases.",
        "A high overall accuracy figure means confidence scores no longer need validation.",
        "Confidence scores should replace sampling of high-confidence extractions."),
     "exp": "正解A。項目ごとに出し正解ラベルで調整した確信度はレビューの振り分けに使える。B: 顧客対応での自己申告は当てにならない。同じ『確信度』でも調整済みかと用途で評価が逆になる。"},
    {"type": "single_choice", "q": "H14. A multi-agent analysis of a large codebase runs for hours. When the process crashes midway, all progress is lost and the run starts over. Which design best allows the run to resume?",
     "opts": s(2,
        "Run /compact more frequently during the run.",
        "Use a model with a larger context window.",
        "Have each agent export structured state to a known location, and have the coordinator load a manifest on resume.",
        "Ask each subagent to remember its progress in its conversation history."),
     "exp": "正解C。各エージェントが状態を書き出し、コーディネーターが再開時にマニフェストを読む。A: コンテキストが埋まったときは /compact が正解。今回はプロセスが落ちても残る状態の保存が問題。"},
    {"type": "single_choice", "q": "H15. After a long analysis of a codebase, you want to compare two refactoring approaches, each starting from the same analysis, without the two explorations affecting each other. What should you use?",
     "opts": s(1,
        "Two new sessions that each repeat the analysis from scratch.",
        "fork_session to create two independent branches from the shared analysis.",
        "One session that tries the first approach and then the second.",
        "--resume twice on the same session name in two terminals."),
     "exp": "正解B。同じ分析を出発点に互いに影響しない2つの枝を作る＝fork_session の用途そのもの。D: 続きから作業するだけなら --resume が正解だが、2か所で再開しても独立した枝にはならない。"},
]

# ===== レッスン本文 =====
MEMO = """CCAR-F の問題は考えて解くものが大半ですが、下の事実は知らないと解けません。存在しないフラグや設定ファイルを使った選択肢が外れとして出るので、**正しい名前を正確に**覚えてください。

## Claude Code の置き場所

| 名前 | 効く範囲 | 覚え方 |
|---|---|---|
| ~/.claude/CLAUDE.md | 自分だけ | ~ で始まるものは個人用。共有されない |
| .claude/CLAUDE.md・ルートの CLAUDE.md | プロジェクト全員 | リポジトリに入るものは共有される |
| サブディレクトリの CLAUDE.md | そのディレクトリ | 場所に縛られる |
| .claude/rules/ ＋ frontmatter の paths | glob に一致するファイルの編集時 | 散らばったファイルに効く |
| .claude/commands/ | プロジェクト全員 | 共有スラッシュコマンド |
| ~/.claude/commands/ | 自分だけ | 個人用コマンド |
| .claude/skills/ の SKILL.md | プロジェクト全員 | 必要なときに呼ぶ手順 |
| ~/.claude/skills/ | 自分だけ | 個人用は別名で作る |
| .mcp.json | プロジェクト全員 | 共有MCPサーバー。${VAR} で環境変数展開 |
| ~/.claude.json | 自分だけ | 個人用・実験用のMCPサーバー |

## コマンド・フラグ・設定値

| 名前 | 意味 |
|---|---|
| -p / --print | 非対話モード。CIではこれがないと入力待ちで止まる |
| --output-format json | 出力を JSON にする |
| --json-schema | 出力のスキーマを強制する |
| --resume &lt;session-name&gt; | 名前付きセッションを再開する |
| fork_session | 共通の分析から独立した枝を作る |
| /memory | 読み込まれているメモリファイルを確認する |
| /compact | コンテキストを圧縮する |
| @import | CLAUDE.md から外部ファイルを取り込む |
| context: fork | スキルを独立したコンテキストで実行する |
| allowed-tools | スキル実行中に使えるツールを制限する |
| argument-hint | 引数なしで呼ばれたときに入力を促す |

## Agent SDK と API

| 名前 | 意味 |
|---|---|
| stop_reason: "tool_use" | ツール実行を求めている。ループを継続する |
| stop_reason: "end_turn" | 完了。ループを終了する |
| Task ツール | サブエージェントを起動する仕組み |
| allowedTools | コーディネーターが委任するには "Task" を含める |
| AgentDefinition | サブエージェントの説明・システムプロンプト・ツール制限 |
| PostToolUse | ツール結果をモデルが見る前に変換するフック |
| tool_choice: "auto" | ツールを呼ばずテキストで返すこともある |
| tool_choice: "any" | 必ずどれかのツールを呼ぶ |
| tool_choice: {"type":"tool","name":"..."} | 指定したツールを必ず呼ぶ |
| isError | MCP ツールの失敗を伝えるフラグ |
| errorCategory・isRetryable | エラーの種類と再試行可否 |
| custom_id | バッチのリクエストと結果を突き合わせる |

## 覚えておく数字

| 項目 | 数字 |
|---|---|
| 問題数と時間 | 60問・120分（1問2分） |
| 合格点 | 720（100〜1,000のスケール） |
| シナリオ | 6つのうち4つが出題 |
| 配点 | 分野1が27%、分野3と4が各20%、分野2が18%、分野5が15% |
| Message Batches API | 費用50%減・最大24時間・遅延の保証なし |
| few-shot の例 | 2〜4個 |
| 入出力の例 | 2〜3組 |
| ツールの数 | 4〜5個が目安（18個は多すぎる例） |
| 再受験の待機 | 14日・30日・90日（12か月で最大4回） |
"""

DISCRIMINATE = """同じ論点でも、**問題文の条件が1つ変わると正解が入れ替わります**。どの条件がどちらの答えを指すかを覚えてください。

## 紛らわしい選択肢の見分け方

| 論点 | 問題文の合図 | 選ぶもの |
|---|---|---|
| セッション | 以前の調査がおおむね有効。変わったのは数ファイル | --resume で再開し、変更点を伝える |
| セッション | 大半が変わり、以前のツール結果が古い | 構造化した要約を渡して新しく始める |
| セッション | 同じ分析から2つの案を比べたい | fork_session |
| 規則の守らせ方 | 金銭・本人確認・法令など、違反が1件でも許されない | フックや前提条件ゲートで強制する |
| 規則の守らせ方 | 口調・書式・望ましい振る舞い | プロンプトと few-shot で足りる |
| tool_choice | 会話で答える場合と、ツールを使う場合が両方 | "auto" |
| tool_choice | 必ずツールを呼ばせたい。どれを呼ぶかは任せる | "any" |
| tool_choice | 最初に必ず特定のツールを呼ばせたい | 強制指定し、続きは次のターン |
| 規約の置き場所 | 全員に常に効かせたい共通規約 | プロジェクトの CLAUDE.md |
| 規約の置き場所 | 複数ディレクトリに散らばる種類のファイル | .claude/rules/ と paths |
| 規約の置き場所 | ときどき使う、タスク別の手順 | スキル |
| 規約の置き場所 | 別ファイルの規約を、パッケージごとに選んで取り込む | @import |
| 進め方 | 多数のファイル・設計判断・複数の妥当な案 | plan mode |
| 進め方 | 原因も範囲も明確な小さな修正 | 直接実行 |
| 進め方 | 調査の出力が多く、コンテキストが尽きる | Explore サブエージェント |
| API の選択 | 人が結果を待っている。期限が24時間より短い | 同期 API |
| API の選択 | 夜間や週次で、待てる | Message Batches API |
| API の選択 | 1リクエストの途中でツールを実行する | バッチは使えない |
| 再試行 | 形式や構造の誤り | 検証エラーを添えて再試行 |
| 再試行 | 情報が渡した文書にない | 再試行しない。文書を足すか人に回す |
| 顧客対応 | 顧客が人を明確に求めた | 直ちに引き継ぐ |
| 顧客対応 | 怒っているが人は求めていない。対応できる範囲 | 受け止めて解決を申し出る |
| 顧客対応 | ポリシーに定めがない、または曖昧 | 引き継ぐ |
| 顧客対応 | 複雑だが、ポリシーが各部分を明確に定めている | 自分で解決。複雑さだけでは引き継がない |
| 顧客対応 | 候補が複数見つかった | 追加の識別情報を尋ねる |
| エラー | 一時的な失敗（タイムアウト・503） | サブエージェント内でまず回復を試みる |
| エラー | 自力で解決できなかった | 種類・試した内容・途中結果を添えて上げる |
| エラー | 検索は成功し、該当が0件 | 正常な結果として返す。再試行しない |
| プロンプトの改善 | ツールの説明が最小限で、誤ったツールが選ばれる | 説明を書き足す |
| プロンプトの改善 | 説明は十分だが、曖昧な依頼で判断がぶれる | 理由つきの few-shot の例 |
| プロンプトの改善 | 指摘の対象が広すぎて、誤検知が多い | 報告する対象としない対象を定義する |
| プロンプトの改善 | 出力の形式がばらつく | 形式を示す few-shot の例 |
| 出力の保証 | JSON が壊れる・構文エラー | tool_use と JSON スキーマ |
| 出力の保証 | 構文は正しいが、中身の整合性が取れない | 意味の検証を別に入れる |
| 確信度 | 顧客対応で、引き継ぐかの判断に使う | 使わない。自己申告は当てにならない |
| 確信度 | 抽出で項目ごとに出し、正解ラベルで調整済み | レビューの振り分けに使える |
| 長い作業 | 発見が後で失われる | スクラッチパッドファイル |
| 長い作業 | コンテキストが探索の出力で埋まった | /compact |
| 長い作業 | クラッシュ後に、やり直さず再開したい | 状態の書き出しとマニフェスト |
| レビュー | 同じセッションで生成したコードを見直す | 独立したインスタンスに任せる |
| レビュー | 多数のファイルで、深さがばらつく | ファイルごとのパスと統合パスに分ける |
| タスク分解 | 手順が予測できる | prompt chaining |
| タスク分解 | 途中の発見で次の作業が変わる | 動的な分解 |

## 英語の問題文を速く読む

**問題文の最後の1文が「何を聞いているか」を決めます。** 先に最後の1文を読み、それから状況を読むと、1問2分のペースを守りやすくなります。

### 設問の言い回し → 正解の方向

| 英語 | 意味 | 正解の方向 |
|---|---|---|
| most effective first step | 最初に取るべき最も効果的な手 | 軽くてすぐできる対策。大がかりな作り直しは外れ |
| most likely root cause | 最も可能性の高い根本原因 | ログや数字が指す箇所。正しく動く部分を責める選択肢は外れ |
| most maintainable | 最も保守しやすい | 複製や手作業の更新がいらない方法 |
| most reliable / guarantee | 最も確実・保証する | コードによる強制・スキーマ・強制指定 |
| most directly addresses | 最も直接的に対処する | 原因そのものに効くもの。遠回りは外れ |
| best enables | 最もよく可能にする | 判断に必要な情報を渡すもの |
| How should you evaluate this proposal? | この提案をどう評価すべきか | 提案の一部だけが正しいことが多い |
| Select TWO | 2つ選ぶ | 2つとも合って正解。残りに過剰な対策が混ざる |

### 状況を表す単語

escalate＝人に引き継ぐ / handoff＝引き継ぎ / policy gap・policy is silent＝ポリシーに定めがない / deterministic＝確定的 / probabilistic compliance＝確率的な順守（守られないことがある） / prerequisite＝前提条件 / intercept＝割り込む / misroute＝誤った宛先に振り分ける / transient＝一時的 / retryable＝再試行できる / propagate＝上位へ伝える / suppress＝握りつぶす / stale＝古くなった / false positive＝誤検知 / dismiss＝指摘を却下する / latency-tolerant＝遅れても困らない / nullable・optional＝値がなくてよい / fabricate・hallucination＝値を捏造する / provenance・attribution＝出典・由来 / coverage gap＝カバーできていない範囲 / stratified random sampling＝層化無作為抽出 / calibrate＝正解データに合わせて調整 / over-engineered＝過剰な作り込み / proportionate＝問題の大きさに見合った

### ほぼ常に『外れ』の言い回し

- emphasize / in capital letters（強調しても確率的な順守のまま）
- switch to a larger model / larger context window（原因に効かない）
- self-report a confidence score and route below a threshold（自己申告は当てにならない）
- sentiment analysis（感情は難しさと相関しない）
- deploy a separate classifier / routing layer（過剰）
- return an empty result marked as successful（エラーの握りつぶし）
- terminate the entire workflow（1つの失敗で全体を止めるのは誤り）
- run it several times and keep only what appears in most runs（本物の問題を落とす）
"""

PLAN = """受験できるのはパートナー承認の後なので、それまでの待ち時間を準備にあてます。合計の目安は **25〜30時間** です。

## 学習の順番

| 段階 | やること | 目安 | 次へ進む基準 |
|---|---|---|---|
| 1 | 日本語要点ガイドを通読し、模擬問題集の第1弾（日本語35問）を解く | 4時間 | 28問以上の正解 |
| 2 | 間違えた分野の公式ドキュメントを読む（配点の大きい分野1から） | 8〜10時間 | 試験ガイド6章の各項目を自分の言葉で説明できる |
| 3 | 試験ガイド8章の練習課題を作る（課題1と4を優先） | 8〜10時間 | フック・サブエージェント・構造化エラーを自分で動かした |
| 4 | 第2弾（英語30問）を60分で解く | 2時間 | 24問以上の正解、かつ時間内 |
| 5 | この資料の3つの表を覚え、最難関15問を30分で解く | 3時間 | 12問以上の正解 |
| 6 | 試験ガイド9章のサンプル問題12問を、原文の英語で解き直す | 1時間 | 全問正解し、外れる理由も言える |

> **段階3を飛ばさないでください。** 試験は実務の判断を問う形式で、読むだけで届く範囲には限りがあります。特に Agent SDK を触ったことがない場合、最大配点の分野1が手薄になります。

## 当日の時間配分

- 60問を120分なので、**1問2分**。15問ごとに30分を過ぎていないか確かめる。
- 各問、**最後の1文を先に読んでから**状況を読む。
- 2分考えて決まらない問題は、仮の答えを選んで先へ進む。見直しの時間を10分残す。
- 複数選択は、**選ぶ数を必ず確かめる**（問題文に明記されている）。
- 迷ったら、原因に直接効く、いちばん手間の小さい選択肢を選ぶ。

## 受験前の確認

- 会社のメールドメインがパートナー記録に登録されているか（未登録だと登録で弾かれ、追加に7〜10日）。
- Pearson VUE に登録した氏名が、身分証の表記と完全に一致しているか（不一致だと受験できず、受験料も戻らない）。
- オンライン受験なら、事前に Pearson のシステムテストを実行する。
- キャンセルと変更は、予約の48時間前までに行う。

## この資料の限界

問題はすべて試験ガイドの出題項目から作ったオリジナルで、本番の問題そのものではありません。本番の難易度や出題の偏りは、受けてみるまで分かりません。試験ガイドは2026年7月版で、製品ドキュメントはその後も更新されています。食い違う箇所があれば、**試験ではガイドの表記が基準**になります。
"""


def main():
    assert len(QA) == 35 and len(QB) == 22 and len(QC) == 12 and len(QH) == 15
    c = b.sb(env, "POST", "courses", {
        "title": "CCAR-F 直前対策 ｜ 知識固めドリル＆暗記・見分け方",
        "description": "模擬問題集（第1弾・第2弾）のあとに使う、仕上げ用コース。○×・用語・応用の知識固めドリルと、暗記シート・紛らわしい選択肢の見分け方・最難関15問・試験当日までのロードマップをまとめています。",
        "status": "published", "is_sequential": False, "created_by": ADMIN_UUID})[0]
    print(f"講座作成: {c['id']}")

    sec1 = b.sb(env, "POST", "sections", {
        "course_id": c["id"], "title": "知識固めドリル（69問）", "sort_order": 0})[0]["id"]
    print(f"section1: {sec1}")
    quiz(sec1, "○×ドリル 35問", "知識を素早く確かめる○×問題。×はどこが誤りかまで言えると本番で迷わない。目安6分。", 0, QA, passing=90)
    quiz(sec1, "用語ドリル 22問", "正しい名前を自力で思い出す練習。本番は選択式で、存在しないフラグ名が外れに混ざる。", 1, QB, passing=90)
    quiz(sec1, "応用ドリル 12問（英語）", "第1弾・第2弾で扱っていない論点だけを集めた応用問題。24分。", 2, QC, passing=80)

    sec2 = b.sb(env, "POST", "sections", {
        "course_id": c["id"], "title": "直前対策（暗記・見分け方・最難関15問）", "sort_order": 1})[0]["id"]
    print(f"section2: {sec2}")
    lesson(sec2, "暗記シート（置き場所・コマンド・API・数字）", MEMO, 0)
    lesson(sec2, "見分け方シート＆英語の読み方", DISCRIMINATE, 1)
    quiz(sec2, "最難関 15問（条件の読み落としを突く）",
         "どの問題も、別の状況なら正解になる選択肢を1つ以上含む。条件を読み落とすと引っかかる。30分。", 2, QH, passing=80, minutes=30)
    lesson(sec2, "試験当日までの進め方", PLAN, 3)

    for uid in MEMBERS:
        b.sb(env, "POST", "enrollments", {"user_id": uid, "course_id": c["id"], "status": "active"})
    print(f"受講登録: {len(MEMBERS)}名")
    print(f"受講URL: /courses/{c['id']}")
    print("完成 🎓")


if __name__ == "__main__":
    main()
