#!/usr/bin/env python3
"""CCAR-F（Claude認定試験）合格対策コースを一括作成する。

作るもの（1コース / 1セクション）:
  sort 0: レッスン「CCAR-F とは・本番での解き方」
  sort 1: テスト「第1弾 模擬問題 35問（日本語・解説付き）」  合格8割(28/35)・70分
  sort 2: テスト「第2弾 模擬問題 30問（本番形式・英語）」  合格8割(24/30)・60分
  ＋ 管理者・南條・小中 を受講登録

出典: ユーザー作成の docx 2本（@seiyakitazume, 2026-10-11）をそのまま教材化。
build.py の load_env / sb を再利用（.env.local の SUPABASE_* を使用）。
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ADMIN_UUID = "bab3dae7-813b-43ee-b7f9-200ca779dcfd"
MEMBERS = [
    ADMIN_UUID,                                # Seiya Kitazume (admin)
    "8936dff0-704d-4d2f-bff0-c84869eec0fc",    # 南條 健人
    "fd11370b-58d9-4d8c-b95b-bdd851515f34",    # 小中
]
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
    payload = {
        "section_id": section_id, "title": title, "description": desc,
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


# ---------------------------------------------------------------------------
INTRO = """CCAR-F（Claude認定試験）の合格対策コースです。あなたが作った模擬問題集2本を、本番と同じ形式で受けられるようにしました。

## このコースの進め方

1. **第1弾（35問・日本語）** … 試験ガイドの出題項目30個を1問以上でカバー。1問ずつ解いて、解答後に表示される解説で復習できます。目安は70分。
2. **第2弾（30問・英語）** … 本番と同じく英語・シナリオ形式。第1弾で扱っていない論点と、細かい判断を問う問題。目安は60分。

どちらも **8割（第1弾28/35・第2弾24/30）** を合格ラインの目安にしています。間違えた問題は、何度でも受け直せます。

## 出題分野（第1弾）

- **分野1 Agentic Architecture & Orchestration** … エージェントのループ制御、サブエージェントの分業・並列・コンテキスト受け渡し、フックによるルール強制
- **分野2 Tool Design & MCP Integration** … ツールの説明文設計、エラーの返し方、tool_choice、MCPサーバーの共有設定
- **分野3 Claude Code Configuration & Workflows** … CLAUDE.md の階層、スキル、ルールファイル、CIでの実行(-p/JSON出力)
- **分野4 Prompt Engineering & Structured Output** … few-shot例、JSONスキーマの限界、Message Batches API、別インスタンスでのレビュー
- **分野5 Context Management & Reliability** … 事実の抜き出し、人への引き継ぎ判断、スクラッチパッド、層化抽出による品質管理

## 本番での解き方（迷ったらこの順で絞る）

1. **問題文が示す原因を特定する。** ログや数字が書かれていれば、それが原因を指している。
2. **その原因に直接効く選択肢を残す。** 別の問題を解いている選択肢を消す。
3. **残った中で、いちばん手間の小さいものを選ぶ。** 別モデルの追加・分類器・振り分け層は、たいてい過剰として外れる。
4. **金銭や本人確認など確実さが必要な場面では、プロンプトではなくコードによる強制を選ぶ**（フックなど）。
5. **「強調する」「より慎重にと指示する」「大きなモデルに変える」「確信度を自己申告させてふるい分ける」は、ほぼ常に外れ。**
6. **存在しない機能を使う選択肢に注意する。** 見覚えのないフラグや設定ファイルは疑う。

準備ができたら、下の「第1弾」から始めてください。合格を目指して、いきましょう。"""


def s(correct, *opts):
    """単一選択の opts を作る。correct は 0始まりの正解index。"""
    return [(t, i == correct) for i, t in enumerate(opts)]


def m(correct_set, *opts):
    """複数選択の opts。correct_set は正解indexの集合。"""
    return [(t, i in correct_set) for i, t in enumerate(opts)]


# ===== 第1弾: 35問（日本語・解説付き）=====
Q1 = [
    {"type": "single_choice",
     "q": "【1.1】在庫照会エージェントが、作業の途中でときどき止まってしまう。実装を見ると、アシスタントの応答にテキストが含まれていたらループを終了する作りになっていた。最も適切な修正はどれか。",
     "opts": s(1,
        "反復回数の上限を10回に設定し、上限に達したら終了する",
        'stop_reason が "tool_use" の間は継続し、"end_turn" で終了する',
        "システムプロンプトに「完了したら DONE と書くこと」と指示し、その文字列で終了を判定する",
        "テキストが2回連続で返ってきたら終了する"),
     "exp": "正解B。ループの継続と終了は stop_reason で判定する（tool_use なら継続、end_turn で終了）。A: 回数上限を主な停止手段にするのは避けるべき実装。C: 文面からの終了判定も同じ。D: テキストの有無は完了の印にならない（モデルはツール呼び出しと一緒にテキストを返すことがある）。"},
    {"type": "single_choice",
     "q": "【1.2】調査システムで、コーディネーターはどんな質問でも検索・文書分析・統合・レポートの4つのサブエージェントを順番に全部呼び出す。単純な事実確認の質問でも数分かかっている。最も適切な改善はどれか。",
     "opts": s(2,
        "各サブエージェントのモデルを高速なものに変える",
        "サブエージェント同士が直接やりとりできるようにして、コーディネーターを経由しない",
        "コーディネーターが質問の要件を分析し、必要なサブエージェントだけを動的に選ぶ",
        "4つのサブエージェントを1つに統合する"),
     "exp": "正解C。コーディネーターの役割は、問い合わせの複雑さに応じて呼ぶサブエージェントを選ぶこと。常に全工程を通す必要はない。A: 原因を直さない。B: コーディネーターを経由しないと可観測性と一貫したエラー処理を失う。D: 専門分化の利点を捨てる過剰な変更。"},
    {"type": "single_choice",
     "q": "【1.3】統合サブエージェントの出力が、検索サブエージェントの見つけた記事に触れず一般論ばかりになっている。ログを見ると、コーディネーターは統合サブエージェントに「調査結果を統合してレポートにして」とだけ渡していた。最も可能性の高い原因と対策はどれか。",
     "opts": s(0,
        "サブエージェントは親のコンテキストを引き継がないので、検索結果をプロンプトに明示的に含める",
        "統合サブエージェントのコンテキストウィンドウが小さいので、大きなモデルに変える",
        "検索サブエージェントの結果の質が低いので、検索クエリを増やす",
        "統合サブエージェントにWeb検索ツールを与えて、自分で調べ直させる"),
     "exp": "正解A。サブエージェントは独立したコンテキストで動き、親の履歴を自動では引き継がない。前段の成果はプロンプトに含めて渡す。B・C: ログが示す原因（何も渡していない）と合わない。D: 統合役に検索ツールを持たせると役割外の誤用を招き、検索済みの結果も活かせない。"},
    {"type": "single_choice",
     "q": "【1.3】コーディネーターが3つのサブエージェントを1つずつ順番に起動していて全体が遅い。3つの作業は互いに依存しない。並列に実行する方法として正しいものはどれか。",
     "opts": s(3,
        "fork_session で3つのセッションに分岐させる",
        "Message Batches API に3つのリクエストをまとめて送る",
        "3つのサブエージェントに同じプロンプトを渡して、速く終わったものを採用する",
        "コーディネーターの1回の応答の中で、3つの Task ツール呼び出しを出す"),
     "exp": "正解D。並列実行は、コーディネーターの1回の応答で複数の Task 呼び出しを出すことで行う。A: fork_session は共通の分析から別アプローチを試すための分岐。B: バッチAPIは待てる処理向けで、サブエージェント起動の仕組みではない。C: 同じ作業を重複させるだけ。"},
    {"type": "single_choice",
     "q": "【1.4/1.5】返金処理エージェントで、500ドルを超える返金は必ず人の承認が必要という社内規則がある。システムプロンプトに明記しているが、月に数件、承認なしで実行されてしまう。最も適切な対策はどれか。",
     "opts": s(1,
        "システムプロンプトの該当箇所を大文字で強調し、冒頭に移す",
        "ツール呼び出しに割り込むフックで500ドル超の返金をブロックし、人への引き継ぎに回す",
        "規則を守った例を few-shot で5つ追加する",
        "返金のたびに、エージェント自身に規則を守ったか確認させる"),
     "exp": "正解B。確実な順守が必要な業務ルールは、フックでコード側から強制する。プロンプトの指示は失敗率がゼロにならない。A・C・D: いずれも確率的な順守にとどまり、金銭に直結する場面では不十分。"},
    {"type": "single_choice",
     "q": "【1.5】エージェントが3つの外部MCPサーバーのツールを使っている。日時の形式がUnixタイムスタンプ・ISO 8601・独自の数値コードとばらばらで、エージェントが日付の比較を間違える。サーバー側は自社で変更できない。最も適切な対策はどれか。",
     "opts": s(0,
        "PostToolUse フックで、モデルが処理する前に形式を統一する",
        "システムプロンプトに各ツールの日時形式の説明を追加する",
        "日付の比較が必要なときは、必ず人に引き継ぐ",
        "tool_choice で、形式が同じツールだけを使うよう強制する"),
     "exp": "正解A。PostToolUse フックは、ツール結果をモデルが処理する前に変換できるので形式の統一に向く。B: モデルに毎回変換させるのは確率的で誤りが残る。C: 引き継ぎの基準に当たらない過剰な対応。D: tool_choice は形式の問題を解かない。"},
    {"type": "single_choice",
     "q": "【1.6】「テストがほとんどないレガシーコードベースに、網羅的なテストを追加する」というタスクを任された。進め方として最も適切なものはどれか。",
     "opts": s(2,
        "ファイルをアルファベット順に1つずつ処理する固定パイプラインを組む",
        "全ファイルを一度に読み込ませ、1回の指示ですべてのテストを生成させる",
        "まず構造を把握して影響の大きい箇所を特定し、依存関係が分かるたびに見直す優先順位付きの計画を作る",
        "テストを書きやすい小さなユーティリティ関数から順に進める"),
     "exp": "正解C。先の読めない開いたタスクは、構造の把握→影響の大きい箇所の特定→状況に応じて見直す計画、の順で動的に分解する。A: 固定パイプラインは予測できる作業向け。B: 一度に処理すると注意が分散する。D: 書きやすさ優先で、影響の大きい箇所が後回しになる。"},
    {"type": "single_choice",
     "q": "【1.7】昨日、名前付きセッションでコードベースを調査した。その後、同僚の大規模なリファクタリングがマージされ、調査したファイルの大半が書き換わった。今日、調査の続きをしたい。最も確実な進め方はどれか。",
     "opts": s(3,
        "--resume でセッションを再開し、そのまま続きを指示する",
        "fork_session で昨日のセッションから分岐して続ける",
        "--resume で再開し、/compact を実行してから続ける",
        "昨日の発見を構造化した要約にまとめ、それを渡して新しいセッションを始める"),
     "exp": "正解D。大半のファイルが変わり、以前のツール結果が古くなっている。構造化した要約を渡して新規に始めるほうが確実。A: 古いツール結果をもとに誤った前提で進む。B: 分岐しても古い結果を引き継ぐ。C: 圧縮しても内容は古いまま。（変更が数ファイルだけなら、再開して変更点を伝える方法が適切。）"},
    {"type": "single_choice",
     "q": "【2.1】エージェントに search_inventory（「在庫を検索する」）と search_catalog（「商品を検索する」）の2つのツールがある。「この部品はまだ倉庫にある？」という質問で search_catalog が呼ばれることが多い。最初に取るべき対策はどれか。",
     "opts": s(1,
        "2つのツールを1つに統合し、内部で振り分ける",
        "それぞれの説明に、扱うデータ・入力形式・質問の例・もう一方との使い分けを書き足す",
        "ユーザーの入力からキーワードを検出して、ツールを事前に選ぶ振り分け層を作る",
        "tool_choice で search_inventory を常に強制する"),
     "exp": "正解B。モデルは主に説明文でツールを選ぶ。最小限の説明が原因なので、説明の書き分けが最初の一手。A: 妥当な設計ではあるが最初の一手としては重い。C: 過剰で、モデルの言語理解を迂回する。D: 商品の検索ができなくなる。"},
    {"type": "single_choice",
     "q": "【2.2】返金ツールは、失敗するとどんな理由でも「Operation failed」とだけ返す。ログを見ると、ポリシー上認められない返金をエージェントが何度も再試行している。最も適切な修正はどれか。",
     "opts": s(0,
        "エラーの種類・再試行できるかどうか・人が読める説明を構造化して返す",
        "再試行は最大2回までとシステムプロンプトに書く",
        "失敗したら例外を投げて、エージェントを終了させる",
        "失敗時は空の結果を成功として返し、エージェントに先へ進ませる"),
     "exp": "正解A。エラーの種類と再試行可否が分かれば、エージェントは再試行をやめて顧客に説明できる。B: 回数を減らすだけで無駄な再試行は残る。C: 1つの失敗で全体を止めるのは避けるべき実装。D: 失敗を成功として返すのは握りつぶし。"},
    {"type": "single_choice",
     "q": "【2.2/5.3】検索サブエージェントは、該当する文書が0件のときも、検索サービスがタイムアウトしたときも、空の配列を返している。その結果、コーディネーターは「情報が存在しない」と結論づけたレポートを出した。最も適切な修正はどれか。",
     "opts": s(2,
        "空の配列が返ったら、コーディネーターが必ず3回再試行する",
        "タイムアウト時はワークフロー全体を停止する",
        "アクセス失敗と、該当なしという正常な結果を区別して返す",
        "検索サブエージェントのタイムアウト時間を延ばす"),
     "exp": "正解C。アクセス失敗と、該当なしという正常な空の結果は別物。区別して返せば、コーディネーターが再試行や注記を判断できる。A: 本当に0件のときも無駄に再試行する。B: 全体停止は避けるべき実装。D: 区別できない問題は残る。"},
    {"type": "single_choice",
     "q": "【2.3】統合サブエージェントには、全サブエージェント共通の18個のツールが与えられている。統合の途中で自分でWeb検索を始めたり、ツール選択を間違えたりする。最も適切な対策はどれか。",
     "opts": s(3,
        "システムプロンプトに「統合以外のことはしない」と書く",
        "18個のツールすべての説明文を、より詳しく書き直す",
        "統合サブエージェントをより高性能なモデルに変える",
        "統合に必要なツールだけに絞って与える"),
     "exp": "正解D。ツールが多すぎると選択の信頼性が下がり、専門外のツールは誤用されやすい。役割に必要なものだけ与える。A: プロンプトでの禁止は確率的。B: 数の多さという原因が残る。C: モデルを変えても選択肢の多さは変わらない。"},
    {"type": "single_choice",
     "q": "【2.3/4.3】抽出システムに、請求書用・契約書用・領収書用の3つの抽出ツールがある。文書の種類は事前には分からない。モデルがときどきツールを呼ばず、文章で内容を説明して終わってしまう。最も適切な設定はどれか。",
     "opts": s(1,
        'tool_choice: "auto" のまま、システムプロンプトで「必ずツールを使うこと」と指示する',
        'tool_choice: "any" にする',
        "tool_choice で請求書用ツールを強制指定する",
        "3つのツールを同時に呼ぶよう指示する"),
     "exp": '正解B。"any" は必ずいずれかのツールを呼ばせ、どれを呼ぶかはモデルが選ぶ。種類が不明な文書に合う。A: "auto" はテキストで返す余地が残る。C: 契約書や領収書に請求書用ツールが使われる。D: 無関係な抽出が走る。'},
    {"type": "single_choice",
     "q": "【2.4】チーム全員が同じGitHub用MCPサーバーを Claude Code で使えるようにしたい。認証トークンはリポジトリにコミットしたくない。最も適切な設定はどれか。",
     "opts": s(0,
        "プロジェクトの .mcp.json にサーバーを定義し、トークンは ${GITHUB_TOKEN} の環境変数展開で渡す",
        "各メンバーが ~/.claude.json に、自分でサーバーとトークンを書く",
        "プロジェクトの CLAUDE.md に、サーバーの接続手順とトークンを書く",
        ".mcp.json にトークンを直接書き、.gitignore に .mcp.json を追加する"),
     "exp": "正解A。チーム共有はプロジェクトの .mcp.json、秘密情報は環境変数展開で渡す。B: 個人設定なので共有されず、各自の設定がずれる。C: CLAUDE.md はサーバー定義の場所ではなく、トークンも漏れる。D: .gitignore に入れると共有できない。"},
    {"type": "single_choice",
     "q": "【2.5】設定ファイルの中で、timeout: 30 という行を1か所だけ書き換えたい。Edit ツールを使うと、同じ文字列がファイル内に複数あるため失敗した。最も確実な進め方はどれか。",
     "opts": s(1,
        "Grep でファイル全体を検索し、一致した行をすべて書き換える",
        "Read でファイル全体を読み込み、修正した内容を Write で書き戻す",
        "Glob で同名のファイルを探し、別のファイルで試す",
        "同じ Edit を、成功するまで繰り返す"),
     "exp": "正解B。Edit が目印の重複で失敗したら、Read で全体を読んで Write で書き戻す。A: 変えたくない箇所まで書き換わる。C: 対象のファイルが違う。D: 同じ理由で失敗し続ける。"},
    {"type": "single_choice",
     "q": "【3.1】先月入社したメンバーの Claude Code だけ、チームの命名規約に従わないコードを出す。規約は、最初に環境を整えたリード開発者が自分の ~/.claude/CLAUDE.md に書いたものだった。最も適切な対処はどれか。",
     "opts": s(2,
        "新メンバーに、リード開発者の ~/.claude/CLAUDE.md を自分のホームディレクトリへコピーしてもらう",
        "新メンバーの Claude Code を再インストールする",
        "規約をプロジェクトレベルの CLAUDE.md に移し、リポジトリで共有する",
        "規約をスキルにして、毎回手動で呼び出してもらう"),
     "exp": "正解C。~/.claude/CLAUDE.md はその人だけに効き、バージョン管理で共有されない。チームの規約はプロジェクトレベルに置く。A: 次の新メンバーでも同じ問題が起き、内容もずれていく。B: 設定の置き場所の問題で、インストールは無関係。D: 規約は常に読み込まれるべきもので、手動呼び出しのスキルには向かない。"},
    {"type": "single_choice",
     "q": "【3.2】コードベース全体を分析するスキルを実行すると、大量の出力がメインの会話に流れ込み、その後の作業でコンテキストがすぐ足りなくなる。SKILL.md の frontmatter で設定すべきものはどれか。",
     "opts": s(0,
        "context: fork",
        "allowed-tools",
        "argument-hint",
        "paths"),
     "exp": "正解A。context: fork は、スキルを独立したサブエージェントのコンテキストで実行し、出力をメインの会話に流さない。B: 使えるツールの制限。C: 引数の案内。D: paths はルールファイルの設定で、スキルの設定ではない。"},
    {"type": "single_choice",
     "q": "【3.3】Terraform のファイルがリポジトリ内の複数のディレクトリに散らばっている。Terraform 用の規約を、該当ファイルを編集するときだけ読み込ませたい。最も適切な方法はどれか。",
     "opts": s(3,
        "ルートの CLAUDE.md に Terraform の規約を書き、Claude の判断に任せる",
        "Terraform ファイルがある各ディレクトリに、同じ内容の CLAUDE.md を置く",
        "Terraform 用のスキルを作り、必要なときに手動で呼ぶ",
        ".claude/rules/ にルールファイルを作り、frontmatter の paths に glob パターンを書く"),
     "exp": "正解D。複数ディレクトリに散らばる対象には、glob パターン付きのルールが向く。一致するファイルの編集時だけ読み込まれる。A: 常に読み込まれ、適用も推測頼み。B: 重複して保守しにくい。C: 自動では適用されない。"},
    {"type": "single_choice",
     "q": "【3.4】本番で発生したエラーのスタックトレースから、原因が1つのファイルの日付チェックの条件漏れだと特定できている。進め方として最も適切なものはどれか。",
     "opts": s(1,
        "plan mode でコードベース全体を調査してから修正する",
        "直接実行で、その条件を追加する",
        "Explore サブエージェントで関連ファイルをすべて洗い出してから修正する",
        "まずインタビュー方式で、Claude に設計上の質問をさせる"),
     "exp": "正解B。原因と範囲がはっきりした単一ファイルの修正は、直接実行が適切。A・C: 範囲が明確な修正に調査は過剰。D: 設計判断のない修正に、インタビューは不要。"},
    {"type": "single_choice",
     "q": "【3.5】ログの行を特定の形式に変換する関数を作らせたい。文章で仕様を説明しても、区切り文字や空欄の扱いが毎回違う解釈になる。最も効果的な対策はどれか。",
     "opts": s(0,
        "具体的な入力と、期待する出力の例を2〜3組示す",
        "仕様の説明文をさらに長く、詳しく書く",
        "同じ指示を複数回実行し、多数決で採用する",
        "plan mode に切り替える"),
     "exp": "正解A。文章の説明で解釈がぶれるときは、具体的な入出力例が最も効く。B: 文章を長くしても解釈のぶれは残りやすい。C: ぶれの原因を直さない。D: 伝え方の問題で plan mode の出番ではない。"},
    {"type": "single_choice",
     "q": "【3.6】CIで Claude Code にコードレビューをさせ、指摘をPRのインラインコメントとして自動投稿したい。投稿スクリプトは、ファイル名・行番号・指摘内容を決まった形式で受け取る必要がある。最も適切な実行方法はどれか。",
     "opts": s(2,
        "対話モードで起動し、出力されたテキストを正規表現で解析する",
        "-p で実行し、プロンプトで「JSONで出力して」と頼む",
        "-p に --output-format json と --json-schema を付けて実行する",
        "Message Batches API でレビューを実行する"),
     "exp": "正解C。-p で非対話実行し、--output-format json と --json-schema で機械処理できる構造を強制する。A: 対話モードはCIで入力待ちになる。B: 頼むだけでは形式が保証されない。D: バッチAPIは最大24時間かかり、PRレビューには向かない。"},
    {"type": "single_choice",
     "q": "【3.6】PRに新しいコミットが追加されるたびにCIのレビューが走り、すでに対応済みの指摘や、前回と同じ指摘が何度も投稿される。開発者から苦情が出ている。最も適切な対策はどれか。",
     "opts": s(1,
        "レビューは最初のコミットのときだけ実行する",
        "前回の指摘をコンテキストに含め、新しい問題と未対応の問題だけを報告させる",
        "指摘の件数を、1回あたり3件までに制限する",
        "コードを生成したセッションを再開して、そこでレビューさせる"),
     "exp": "正解B。前回の指摘をコンテキストに入れ、新規または未対応のものだけを報告させる。A: 後続のコミットの問題を見逃す。C: 重複は残り、重要な指摘が落ちることもある。D: 生成したセッションは、自分の変更のレビューに向かない。"},
    {"type": "single_choice",
     "q": "【4.1】自動コードレビューの指摘の多くが、変数名の好みや局所的な書き方への意見で、開発者が指摘を読まなくなった。現在のプロンプトには「確信度の高い問題だけを報告すること」と書いてある。最も効果的な改善はどれか。",
     "opts": s(1,
        "「非常に確信度の高い問題だけ」と、表現をさらに強める",
        "報告する対象（バグ・セキュリティなど）と、報告しない対象（軽微なスタイルなど）を具体的に定義する",
        "各指摘に確信度を10段階で付けさせ、8以上だけを投稿する",
        "レビューを3回実行し、3回とも出た指摘だけを投稿する"),
     "exp": "正解B。「確信度の高いものだけ」のような一般的な指示より、報告対象と対象外の具体的な定義が精度を上げる。A: 同じ種類の曖昧な指示を強めるだけ。C: 自己申告の確信度によるふるい分けは当てにならない。D: 好みの指摘は毎回出るので残り、たまにしか見つからない本物のバグが落ちる。"},
    {"type": "single_choice",
     "q": "【4.2】レビュー結果の出力について、形式を詳しく指示しているのに、指摘ごとに項目の順番や粒度がばらつく。最も効果的な対策はどれか。",
     "opts": s(3,
        "指示文の中で、形式の説明を3回繰り返す",
        "temperature を下げる",
        "出力をもう一度モデルに渡して整形させる",
        "望む形式（場所・問題・重大度・修正案）で書いた例を、2〜4個プロンプトに入れる"),
     "exp": "正解D。詳しい指示でも形式が安定しないときは、望む形式の例を few-shot で示すのが最も効く。A: 繰り返しても安定しない。B: 形式の解釈のぶれという原因を直さない。C: 工程が増えるだけで、整形側でも同じぶれが起きる。"},
    {"type": "single_choice",
     "q": "【4.3】請求書の抽出で、発注番号が書かれていない請求書に対して、モデルがもっともらしい発注番号を作って埋めてしまう。スキーマでは発注番号が必須項目になっている。最も適切な修正はどれか。",
     "opts": s(0,
        "発注番号を任意（nullable）の項目にする",
        "プロンプトに「捏造しないこと」と書き足す",
        "抽出後に、発注番号が実在するかを別のモデルに確認させる",
        "発注番号のない請求書を、処理対象から外す"),
     "exp": "正解A。必須項目にすると、情報がないときにモデルが値を捏造して埋める。任意（nullable）にすれば null を返せる。B: 必須のままでは、何かを埋めるしかない。C: 過剰で、原因を直さない。D: 正当な請求書を処理できなくなる。"},
    {"type": "single_choice",
     "q": "【4.3/4.4】tool_use と厳密なJSONスキーマを使って請求書を抽出している。JSONの構文エラーはなくなったが、明細の合計と総額が一致しない抽出結果がときどき出る。この状況の理解と対策として正しいものはどれか。",
     "opts": s(2,
        "スキーマの strict mode が有効になっていないので、有効にすれば解決する",
        'tool_choice を "any" に変えれば、数値の整合性も保証される',
        "スキーマが防ぐのは構文エラーだけなので、計算した合計と記載された合計を両方抽出して食い違いを検出する",
        "明細の項目を任意にすれば、不一致はなくなる"),
     "exp": "正解C。スキーマとツール呼び出しが防ぐのは構文エラーだけで、意味上の誤りは防げない。計算した合計と記載された合計を両方抽出して突き合わせる。A: strict mode も構文の保証。B: tool_choice は呼ぶツールの制御。D: 任意にしても計算の誤りは防げない。"},
    {"type": "single_choice",
     "q": "【4.4】契約書から「保証期間」を抽出する処理で、ある文書だけ、検証エラーを添えて何度再試行しても失敗する。調べると、その契約書には保証期間の記載がなく「別紙の保証規定による」と書かれていた。別紙は渡されていない。正しい判断はどれか。",
     "opts": s(1,
        "再試行の上限回数を増やす",
        "必要な情報が渡した文書にないので、再試行では解決しない。別紙を渡すか、人のレビューに回す",
        "few-shot の例を追加して、再試行する",
        "より高性能なモデルで再試行する"),
     "exp": "正解B。再試行が効くのは形式や構造の誤り。情報がそもそも文書にないときは、何度やっても解決しない。A・C・D: いずれも存在しない情報を生み出せず、無理に続けると捏造を招く。"},
    {"type": "single_choice",
     "q": "【4.5】夜間の文書分析を Message Batches API に移す。結果は、文書を受け付けてから30時間以内に出す必要がある。バッチの処理には最大24時間かかる。受け付けた文書をためてからバッチを提出する間隔として、要件を確実に満たせる最も長いものはどれか。",
     "opts": s(0,
        "4時間ごと",
        "8時間ごと",
        "12時間ごと",
        "24時間ごと"),
     "exp": "正解A。最悪の場合、文書は提出まで間隔いっぱい待ち、そこから処理に24時間かかる。4時間なら合計28時間で30時間以内に収まる。B: 8+24=32時間で超える。C: 36時間。D: 48時間。計算上の上限は6時間で、選択肢の中で満たすのは4時間だけ。"},
    {"type": "single_choice",
     "q": "【4.6】Claude にコードを生成させ、同じセッションの中で「今のコードをレビューして問題を見つけて」と頼んでいるが、後から見つかるような微妙なバグを見逃すことが多い。最も効果的な改善はどれか。",
     "opts": s(3,
        "「批判的に、厳しくレビューして」と指示を強める",
        "同じセッションで、レビューを2回繰り返す",
        "拡張思考を有効にして、同じセッションでレビューさせる",
        "生成時の文脈を持たない、別の独立したインスタンスにレビューさせる"),
     "exp": "正解D。モデルは生成時の推論の文脈を引きずり、同じセッションでは自分の判断を疑いにくい。文脈を持たない別インスタンスが有効。A・B・C: いずれも同じ文脈の中でのレビューで、同じ思い込みが残る。"},
    {"type": "single_choice",
     "q": "【5.1】顧客対応エージェントは、会話が長くなると古いやりとりを要約して圧縮する。圧縮のあと「返金は8,400円」「配送予定は14日」といった具体的な内容が「返金と配送について相談中」のような曖昧な記述に変わり、エージェントが金額を間違えるようになった。最も適切な対策はどれか。",
     "opts": s(1,
        "要約をやめて、会話をすべてそのまま保持し続ける",
        "金額・日付・注文番号・状態などの事実を、要約とは別のブロックに抜き出し、毎回のプロンプトに含める",
        "要約の指示に「詳しく要約すること」と書き足す",
        "会話が長くなったら、顧客に最初から説明し直してもらう"),
     "exp": "正解B。要約を重ねると数値や日付がぼやける。事実は要約の外の専用ブロックに抜き出し、毎回渡す。A: コンテキストが埋まり、長い会話に対応できない。C: 指示を強めても劣化は残る。D: 顧客に負担を押し付けている。"},
    {"type": "single_choice",
     "q": "【5.2】顧客が最初のメッセージで「AIではなく人間の担当者と話したい」と書いてきた。問い合わせの内容は、エージェントがすぐ解決できそうな住所変更だった。最も適切な対応はどれか。",
     "opts": s(0,
        "調査を挟まず、直ちに人の担当者へ引き継ぐ",
        "まず住所変更を済ませてから、まだ人と話したいかを尋ねる",
        "自分で解決できることを説明し、納得するまで説得する",
        "感情分析で不満の度合いを測り、高ければ引き継ぐ"),
     "exp": "正解A。顧客が明確に人を求めたら、調査を挟まず直ちに引き継ぐ。B: 明確な要望を後回しにしている。C: 説得は要望の無視。D: 感情は引き継ぎの基準として信頼できず、そもそも明確な要望がある。"},
    {"type": "single_choice",
     "q": "【5.2】顧客が氏名だけを伝えて注文状況を尋ねた。get_customer を呼ぶと、同姓同名の顧客が3件返ってきた。最も適切な対応はどれか。",
     "opts": s(2,
        "最後に注文した顧客が本人である可能性が高いので、その顧客を選ぶ",
        "3件すべての注文状況を伝える",
        "メールアドレスや注文番号など、追加の識別情報を尋ねる",
        "判断できないので、直ちに人へ引き継ぐ"),
     "exp": "正解C。候補が複数あるときは推測で選ばず、追加の識別情報を求める。A: 推測による選択で別人の情報を伝える危険がある。B: 他人の情報を漏らす。D: 質問すれば解決できるので、引き継ぎは早すぎる。"},
    {"type": "single_choice",
     "q": "【5.4】大きなコードベースを長時間調査していると、エージェントの回答がぶれ始め、序盤に見つけた具体的なクラス名ではなく「一般的にはこういう構造です」といった説明をするようになった。この現象への対策として最も適切なものはどれか。",
     "opts": s(3,
        "より大きなコンテキストウィンドウのモデルに切り替えれば、根本的に解決する",
        "同じ質問を言い換えて、何度も聞き直す",
        "序盤の調査を、最初からやり直させる",
        "重要な発見をスクラッチパッドファイルに記録させ、以降の質問ではそれを参照させる"),
     "exp": "正解D。長いセッションではコンテキストが劣化する。発見をスクラッチパッドに書き出し、参照させて補う。A: 大きなコンテキストでも劣化は起きる。B: 劣化した文脈のままでは改善しない。C: 同じ劣化を繰り返す。"},
    {"type": "single_choice",
     "q": "【5.5】文書抽出システムの全体の精度が97%に達した。マネージャーが、確信度の高い抽出結果については人のレビューをすべて廃止しようと提案している。最も適切な対応はどれか。",
     "opts": s(1,
        "97%は十分に高いので、提案どおり廃止する",
        "文書の種類別・項目別に精度を確認し、廃止後も高確信度の結果から層化抽出で検査を続ける",
        "精度が100%になるまで、全件の人によるレビューを続ける",
        "モデルの自己申告の確信度が高いものは、検証なしで信頼する"),
     "exp": "正解B。全体の精度が高くても、特定の文書種類や項目の低い性能が隠れていることがある。区分ごとに確認し、層化抽出で検査を続ける。A: 区分別の確認なしに判断している。C: 現実的でなく、工数の集中にも反する。D: 確信度は、正解ラベル付きデータで調整して初めて使える。"},
    {"type": "single_choice",
     "q": "【5.6】調査システムが、ある市場の規模について、信頼できる2つの情報源から違う数値を得た。片方は2024年の調査、もう片方は2026年の調査だった。統合レポートでの扱いとして最も適切なものはどれか。",
     "opts": s(0,
        "両方の数値を、出典と調査時期を付けて記載する",
        "新しいほうの数値だけを記載する",
        "2つの数値の平均を記載する",
        "数値が食い違うので、この項目はレポートから省く"),
     "exp": "正解A。食い違う数値は片方を選ばず、出典と時期を付けて両方残す。時期の違いは矛盾ではなく変化の可能性がある。B: 根拠なく片方を捨てている。C: どの情報源にもない数値を作ることになる。D: 重要な情報が欠ける。"},
]

# ===== 第2弾: 30問（本番形式・英語）=====
# 各問の冒頭にシナリオ名を [ ] で付す。解説は日本語。
S1 = "[S1: Customer Support Resolution Agent] "
S2 = "[S2: Code Generation with Claude Code] "
S3 = "[S3: Multi-Agent Research System] "
S4 = "[S4: Developer Productivity with Claude] "
S5 = "[S5: Claude Code for Continuous Integration] "
S6 = "[S6: Structured Data Extraction] "

Q2E = [
    {"type": "single_choice",
     "q": S1 + "When the agent escalates a case, human agents receive only a short notes field in the ticketing system. They cannot open the conversation transcript, so they ask customers to explain everything again. Which change best fixes this?",
     "opts": s(0,
        "Have the agent compile a structured handoff summary (customer ID, root cause, amounts involved, recommended action) and pass it with the escalation.",
        "Instruct the agent to tell the customer to repeat the issue to the human agent.",
        "Escalate every case before any investigation so that humans handle it from the start.",
        "Add a system prompt instruction telling the agent to be more thorough before escalating."),
     "exp": "正解A。引き継ぎ先の担当者は会話の記録を見られず、顧客に説明をやり直させている。顧客ID・根本原因・金額・推奨対応をまとめた構造化サマリーを渡す。B: 問題をそのまま残している。C: エージェントが解決できる案件まで人に回す。D: 引き継ぐ情報が足りないという原因に効かない。"},
    {"type": "single_choice",
     "q": S1 + 'A customer writes: "This is ridiculous. My order is a week late." They have not asked for a human. Reshipping the order is within the agent\'s capability. What should the agent do?',
     "opts": s(2,
        "Escalate immediately, because the customer is clearly frustrated.",
        "Run sentiment analysis and escalate if the negative score exceeds a threshold.",
        "Acknowledge the frustration and offer to resolve the issue, escalating only if the customer then asks for a human.",
        "Ignore the tone and ask the customer to confirm their identity three times before proceeding."),
     "exp": "正解C。顧客は怒っているが人を求めてはいない。対応できる範囲なので不満を受け止めて解決を申し出て、人を求められたら引き継ぐ。A・B: 感情は引き継ぎの基準にならない。D: 不満を無視して手間を増やしている。"},
    {"type": "single_choice",
     "q": S1 + "A customer asks the agent to match a competitor's lower price. The policy document covers only price adjustments when your own site lowers a price. What should the agent do?",
     "opts": s(1,
        "Decline, because the policy does not mention competitor price matching.",
        "Escalate to a human, because the policy is silent on this specific request.",
        "Approve, because the request is similar to an own-site price adjustment.",
        "Ask the customer for a screenshot of the competitor's price and then approve it."),
     "exp": "正解B。ポリシーは自社サイトの値下げしか定めておらず、競合との価格合わせには触れていない。ポリシーの空白は人に引き継ぐ場面。A: 定めがないことを拒否の根拠にしている。C・D: 定めのない対応を類推で勝手に承認している。"},
    {"type": "single_choice",
     "q": S1 + "A customer sends one message with three concerns: a refund for a damaged item, an address change, and a duplicate charge. The agent resolves the refund and ends the conversation. Which design best addresses this?",
     "opts": s(3,
        "Ask customers to send one concern per conversation.",
        "Increase max_tokens so the agent can write longer answers.",
        "Escalate any message that contains more than one concern.",
        "Decompose the message into distinct items, investigate each using shared context, and synthesize one unified resolution."),
     "exp": "正解D。3つの用件のうち1つしか処理していない。用件ごとに分けて調べ、1つの回答にまとめる。A: 顧客に負担を移している。B: 出力の長さの問題ではない。C: 解決できる案件まで引き継ぐ。"},
    {"type": "multiple_choice",
     "q": S1 + "Each lookup_order call returns more than 40 fields, although only about 5 matter for returns. After several lookups in a long conversation, the agent starts confusing amounts and dates. Which TWO changes address this most directly? (Select TWO.)",
     "opts": m({0, 1},
        "Trim tool outputs to the relevant fields before they accumulate in context.",
        "Extract amounts, dates, order numbers, and statuses into a persistent case facts block included in each prompt.",
        "Increase max_tokens for each response.",
        "Ask the customer to start a new conversation after every third lookup.",
        "Summarize the whole history, including all amounts and dates, into one short paragraph each turn."),
     "exp": "正解A・B。不要な項目がコンテキストに溜まり、金額と日付を取り違えている。出力を必要な項目に絞り、事実は専用ブロックで保持する。C: 出力の上限は関係ない。D: 顧客に負担を移している。E: 要約を重ねると数値や日付がさらにぼやける。"},

    {"type": "single_choice",
     "q": S2 + "Your monorepo has 12 packages. Coding standards live as separate files in docs/standards/. Each package maintainer knows which standards apply to their package and wants Claude to load only those. What is the most maintainable approach?",
     "opts": s(0,
        "In each package's CLAUDE.md, use @import to include only the standards files that apply to that package.",
        "Copy the text of the relevant standards into each package's CLAUDE.md.",
        "Put all standards into the root CLAUDE.md and let Claude decide which apply.",
        "Ask each developer to add the standards to their ~/.claude/CLAUDE.md."),
     "exp": "正解A。規約は別ファイルにあり、パッケージごとに適用するものが違う。各パッケージの CLAUDE.md から @import で必要なものだけ取り込む。B: 複製すると元の規約が変わるたびにずれる。C: 無関係な規約まで常に読み込まれる。D: 個人設定は共有されない。"},
    {"type": "single_choice",
     "q": S2 + "Your team shares a project skill named deploy-check in .claude/skills/. You want a personal version with two extra steps, without changing anything for your teammates. What should you do?",
     "opts": s(2,
        "Edit the project skill and ask teammates to ignore the extra steps.",
        "Add your extra steps to the project CLAUDE.md.",
        "Create a variant with a different name in ~/.claude/skills/.",
        "Add context: fork to the project skill so your changes stay isolated."),
     "exp": "正解C。チームのスキルを変えずに自分用の版がほしいなら、~/.claude/skills/ に別名で作る。A・B: チーム全員に影響する。D: context: fork は実行時のコンテキストを分ける設定で、変更を個人に限定する仕組みではない。"},
    {"type": "single_choice",
     "q": S2 + "Claude generated a caching module with three problems. The fixes interact: changing the cache key format affects both invalidation and serialization. How should you give feedback?",
     "opts": s(1,
        "Report one problem per message and wait for each fix before reporting the next.",
        "Describe all three problems in a single detailed message.",
        "Start a new session and regenerate the module from the original prompt.",
        "Switch to plan mode and ask Claude to restate the requirements."),
     "exp": "正解B。3つの問題の修正が互いに影響する。影響し合う問題は1つのメッセージにまとめて伝える。A: 順番に直すのは独立した問題のときの方法で、先の修正が後の修正で崩れる。C: 作り直しても同じ問題が出うる。D: 要件の確認では直らない。"},
    {"type": "single_choice",
     "q": S2 + "Before refactoring a large legacy payment module, Claude must first explore it. The discovery phase produces very verbose output, and the context window is nearly exhausted before implementation begins. What is the best approach?",
     "opts": s(3,
        "Skip discovery and begin the refactor with direct execution.",
        "Paste the whole module into the prompt so that no exploration is needed.",
        "Ask Claude to explore more quickly and print less output.",
        "Use the Explore subagent for discovery so that only summaries return to the main conversation."),
     "exp": "正解D。調査の出力が多く、実装の前にコンテキストが尽きる。Explore サブエージェントに調査を任せ、要約だけ受け取る。A: 調査なしのリファクタリングは手戻りを招く。B: コンテキストをさらに使う。C: 指示では出力の量を確実に減らせない。"},
    {"type": "single_choice",
     "q": S2 + "Claude follows your team's testing conventions in some sessions and ignores them in others. What should you check first?",
     "opts": s(0,
        "Run the /memory command to verify which memory files are loaded in the session.",
        "Rewrite the testing conventions in stronger language.",
        "Move the conventions into a skill and invoke it manually each time.",
        "Run /compact at the start of every session."),
     "exp": "正解A。セッションによって規約に従ったり従わなかったりする。まず /memory で、どのメモリファイルが読み込まれているかを確かめる。B: 原因を確かめずに対処している。C: 規約は常に読み込まれるべきもの。D: 圧縮は読み込みの問題と無関係。"},

    {"type": "single_choice",
     "q": S3 + "The coordinator never spawns any subagent and tries to do all the research by itself. The subagent definitions are correct. What is the most likely cause?",
     "opts": s(1,
        "The subagents' system prompts are too short.",
        'The coordinator\'s allowedTools does not include "Task".',
        "The coordinator's context window is too small.",
        'tool_choice is set to "auto".'),
     "exp": "正解B。コーディネーターがサブエージェントを一度も起動しない。起動の仕組みは Task ツールで、allowedTools に含まれていないと使えない。A: 定義は正しいと問題文にある。C: 起動しないことの説明にならない。D: auto でもツールは呼べる。"},
    {"type": "single_choice",
     "q": S3 + "The pipeline runs once from search to report. Reports are coherent but often miss parts of the topic. Which change best improves coverage?",
     "opts": s(2,
        "Run the whole pipeline twice and merge the two reports.",
        "Give every subagent all available tools so that each can fill gaps on its own.",
        "Have the coordinator evaluate the synthesis output for gaps, re-delegate targeted queries, and re-invoke synthesis until coverage is sufficient.",
        "Ask the report subagent to write longer reports."),
     "exp": "正解C。1回通すだけで抜けが残る。コーディネーターが統合結果の抜けを評価し、絞った問い合わせで再委任して、十分になるまで繰り返す。A: 同じ抜けを2回作るだけ。B: 役割外のツールは誤用を招く。D: 長くしても、ない情報は増えない。"},
    {"type": "single_choice",
     "q": S3 + "The coordinator gives each subagent a fixed, step-by-step procedure. When sources differ from what the procedure expects, subagents fail or return poor results. How should the coordinator's prompts change?",
     "opts": s(0,
        "Specify the research goals and quality criteria instead of step-by-step procedures.",
        "Add more steps so that the procedure covers every possible situation.",
        "Remove the subagents and let the coordinator do everything.",
        "Force each subagent to call its tools in a fixed order with tool_choice."),
     "exp": "正解A。固定の手順が想定外の情報源に対応できない。目的と品質基準を伝え、サブエージェントが状況に合わせられるようにする。B: すべての状況は列挙できない。C: 専門分化の利点を捨てる。D: 順序の固定は柔軟性をさらに下げる。"},
    {"type": "multiple_choice",
     "q": S3 + "Final reports contain claims with no sources. You find that attribution is lost when findings are summarized between agents. Which TWO changes address the root cause? (Select TWO.)",
     "opts": m({0, 1},
        "Require subagents to output structured claim-source mappings (source URL, document name, relevant excerpt).",
        "Require the synthesis agent to preserve and merge those mappings when it combines findings.",
        "Have the report subagent search the web again to find a source for each claim.",
        "Delete every unsourced claim from the final report.",
        "Switch every subagent to a larger model."),
     "exp": "正解A・B。エージェント間の要約で出典が失われている。主張と出典の対応を構造化して出力させ、統合の段階でも保持させる。C: 後から探し直すと元の出典と違うものが付く恐れ。D: 情報を捨てている。E: 受け渡しの形式という原因に効かない。"},
    {"type": "single_choice",
     "q": S3 + "The synthesis agent receives one long input that concatenates all findings. It handles the first and last parts well but often omits findings from the middle. Which change is most effective?",
     "opts": s(3,
        "Shuffle the order of the findings randomly on each run.",
        "Tell the synthesis agent to read the input more carefully.",
        "Send the same input twice in one prompt.",
        "Place a summary of key findings at the beginning and organize the detailed results under explicit section headers."),
     "exp": "正解D。長い入力の中ほどが抜け落ちる。冒頭に要点のまとめを置き、詳細には見出しを付ける。A: 抜ける場所が変わるだけ。B: 指示では位置の影響は消えない。C: 入力がさらに長くなる。"},

    {"type": "single_choice",
     "q": S4 + "You connected a code-intelligence MCP server whose find_references tool resolves symbol usages precisely. The agent keeps using Grep instead and misses usages behind aliases. The MCP tool's description is one short sentence. What should you do first?",
     "opts": s(1,
        "Remove Grep from the agent's tools so it is forced to use find_references.",
        "Expand the MCP tool's description to explain what it can do, what it returns, and when it beats text search.",
        "Force find_references on every turn with tool_choice.",
        'Add a system prompt line saying "Never use Grep."'),
     "exp": "正解B。高機能なMCPツールがあるのに Grep が使われる。説明が1文しかないのが原因なので、能力と出力を詳しく書く。A: 文字列検索が必要な場面で困る。C: 無関係な作業でも毎回呼ばれる。D: プロンプトでの禁止は確率的で、必要な場面まで妨げる。"},
    {"type": "single_choice",
     "q": S4 + "Your team needs the agent to read and update Jira issues. There is nothing unusual about how your team uses Jira. Which approach is best?",
     "opts": s(0,
        "Use an existing community MCP server for Jira.",
        "Build a custom MCP server for Jira from scratch.",
        "Have the agent call the Jira REST API through Bash with curl.",
        "Export the Jira issues to a file every night and have the agent read the file."),
     "exp": "正解A。標準的な Jira 連携が必要。既存のコミュニティ製MCPサーバーを使い、自作はチーム固有の用途に限る。B: 標準的な用途には過剰。C: 構造化されたツールにならず、認証情報の扱いも危うい。D: 更新ができず、情報も古くなる。"},
    {"type": "single_choice",
     "q": S4 + "To answer questions about your internal documentation, the agent first makes many exploratory tool calls just to learn which sections and database tables exist. How can you reduce these calls?",
     "opts": s(2,
        "Raise the limit on tool calls per task.",
        "Describe every section and table in the system prompt in free-form prose and keep it updated by hand.",
        "Expose the documentation hierarchy and database schemas as MCP resources.",
        "Ask users to name the exact section in each question."),
     "exp": "正解C。何があるかを知るための探索的な呼び出しが多い。文書の階層やスキーマを MCP リソースとして公開する。A: 無駄な呼び出しを許すだけ。B: 手作業の保守でずれる。D: 利用者に負担を移している。"},
    {"type": "single_choice",
     "q": S4 + "The agent must explain how HTTP requests are handled in a large, unfamiliar codebase. Which approach is most effective?",
     "opts": s(3,
        "Read every file in the repository before answering.",
        "Use Glob to list all source files and Read them in alphabetical order.",
        "Run a Bash command that prints the whole repository into the context.",
        "Use Grep to find the entry points, then Read to follow imports and trace the flow."),
     "exp": "正解D。未知のコードベースでのリクエスト処理の流れを説明する。Grep で入口を見つけ、Read で import をたどって段階的に理解する。A・B・C: 最初に全部読むとコンテキストを使い切る。"},
    {"type": "single_choice",
     "q": S4 + "The agent has a generic fetch_url tool for loading design documents. It sometimes fetches unrelated web pages and wanders off task. What is the best change?",
     "opts": s(0,
        "Replace it with a load_document tool that validates that the URL points to a document source.",
        'Add "only fetch documents" to the tool\'s description.',
        "Ask the agent to confirm each URL with the user before fetching.",
        "Remove the ability to load documents entirely."),
     "exp": "正解A。汎用の URL 取得ツールが無関係なページまで取ってしまう。文書の URL かを検証する、制約付きのツールに置き換える。B: 説明に書くだけでは強制にならない。C: 毎回の確認は実用的でない。D: 必要な機能を失う。"},

    {"type": "single_choice",
     "q": S5 + 'Your review bot reports findings in five categories. The "naming" category has a 70% false positive rate, and developers have started ignoring all findings, including accurate security findings. What is the best immediate step?',
     "opts": s(2,
        'Add "be conservative" to the review prompt.',
        "Post only findings that the model rates above 90% confidence.",
        'Temporarily disable the "naming" category while you improve its prompt.',
        "Turn the review bot off until every category is accurate."),
     "exp": "正解C。誤検知の多い1カテゴリのせいで、正確な指摘まで無視されている。そのカテゴリを一時的に止め、信頼を回復しながら改善する。A: 一般的な指示は精度を上げない。B: 自己申告の確信度は当てにならない。D: 正確なセキュリティ指摘まで止めてしまう。"},
    {"type": "single_choice",
     "q": S5 + 'The same kind of issue is labeled "critical" in one pull request and "minor" in another. Which change best makes severity classification consistent?',
     "opts": s(1,
        "Ask the model to double-check each severity label before posting.",
        "Define explicit criteria for each severity level, with a concrete code example for each.",
        'Label every finding "medium".',
        "Run the review twice and keep the higher severity."),
     "exp": "正解B。同じ種類の問題で重大度がぶれる。各レベルの基準を、具体的なコード例つきで定義する。A: 基準がないまま見直してもぶれは残る。C: 重大度の情報が失われる。D: 一貫性ではなく、高い側に寄るだけ。"},
    {"type": "single_choice",
     "q": S5 + "Automated test generation keeps proposing test cases that the test suite already covers. Which change most directly fixes this?",
     "opts": s(0,
        "Provide the existing test files in context when generating tests.",
        "Ask Claude to generate more tests so that some of them are new.",
        "Run test generation only on files that have no tests at all.",
        "Move test generation to the Message Batches API."),
     "exp": "正解A。既存のテストと重複した提案が出る。既存のテストファイルをコンテキストに渡す。B: 重複は減らない。C: テストが一部ある箇所の不足を見逃す。D: 実行方法を変えても重複は残る。"},
    {"type": "single_choice",
     "q": S5 + "Developers dismiss many findings. Your team wants to learn systematically which code constructs trigger false positives. Which change enables this analysis?",
     "opts": s(3,
        "Ask developers to write a paragraph explaining each dismissal.",
        "Lower the number of findings per pull request.",
        "Have the model add a self-reported confidence score to each finding.",
        "Add a detected_pattern field to each structured finding and analyze the patterns of dismissed findings."),
     "exp": "正解D。どのコード構造が誤検知を生むかを体系的に知りたい。各指摘に detected_pattern 欄を持たせ、却下された指摘の傾向を分析する。A: 手間が大きく集計しにくい。B: 分析の材料にならない。C: 確信度は、どの構造が原因かを教えない。"},
    {"type": "single_choice",
     "q": S5 + "A nightly job asks Claude to generate tests, run them with a tool, read the results, and fix failures, all within one request. A teammate proposes moving this job to the Message Batches API to save 50%. How should you evaluate the proposal?",
     "opts": s(1,
        "It works as long as each request has a unique custom_id.",
        "It does not work as designed, because a batch request cannot execute tools mid-request and receive the results.",
        "It works if the job polls for completion every minute.",
        "The only concern is that results may take up to 24 hours."),
     "exp": "正解B。1つのリクエストの中でツールを実行して結果を受け取る処理。バッチAPIはリクエスト途中のツール実行に対応していない。A・C: custom_id やポーリングはこの制約を解かない。D: 遅延だけでなく、そもそも動かない点を見落としている。"},

    {"type": "single_choice",
     "q": S6 + "The field document_category is an enum with six values. When a new kind of document arrives, the model forces it into one of the six, and downstream reports become wrong. Which schema change is best?",
     "opts": s(2,
        "Remove the enum and accept any free-text category.",
        "Make document_category optional so the model can leave it empty.",
        'Add an "other" value together with a detail string field that describes the category.',
        "Add fifty more enum values to cover every category you can imagine."),
     "exp": "正解C。新しい種類の文書が既存の6分類に無理に押し込まれる。other と詳細欄を足して、分類を広げられるようにする。A: 自由記述にすると下流で集計できない。B: 空欄では何の文書か分からない。D: 列挙しきれず、選択の精度も下がる。"},
    {"type": "single_choice",
     "q": S6 + 'The pipeline must always run extract_metadata first and the enrichment tools afterward. With tool_choice: "auto", the model sometimes calls an enrichment tool first. What is the most reliable fix?',
     "opts": s(0,
        'Force the first call with tool_choice: {"type": "tool", "name": "extract_metadata"}, then handle the enrichment steps in follow-up turns.',
        'Set tool_choice: "any" for every call.',
        'Write "ALWAYS call extract_metadata first" in capital letters in the system prompt.',
        "Rename extract_metadata so that it comes first alphabetically."),
     "exp": "正解A。最初に必ず特定のツールを走らせたい。最初の呼び出しでそのツールを強制指定し、続きは次のターンで処理する。B: any はどのツールを呼ぶかまでは決めない。C: プロンプトの強調は確率的。D: 名前の順番は選択に関係しない。"},
    {"type": "single_choice",
     "q": S6 + "You are about to process 50,000 documents through the Message Batches API with a newly written prompt. What should you do first?",
     "opts": s(3,
        "Submit all 50,000 and resubmit whichever ones fail.",
        "Split the documents into 50 batches and submit them all at once.",
        "Switch to the synchronous API for all 50,000 to see errors sooner.",
        "Refine the prompt on a sample set before submitting the full volume."),
     "exp": "正解D。新しいプロンプトで5万件を流す前に、少数のサンプルで仕上げる。初回の成功率が上がり、再提出の費用が減る。A: 欠陥のあるプロンプトで大量の失敗と再提出を招く。B: 分割してもプロンプトの欠陥は同じ。C: 半額の利点を捨てている。"},
    {"type": "single_choice",
     "q": S6 + "In a batch of 1,000 documents, 40 failed because they exceeded the context limit. What is the most efficient next step?",
     "opts": s(1,
        "Resubmit the entire batch of 1,000.",
        "Identify the 40 failed documents by custom_id, split them into chunks, and resubmit only those.",
        "Remove the 40 documents from the dataset.",
        "Resubmit the 40 documents unchanged."),
     "exp": "正解B。40件がコンテキスト上限で失敗した。custom_id で失敗分だけ特定し、分割して再提出する。A: 成功した960件まで再処理して無駄。C: データを捨てている。D: 同じ理由でまた失敗する。"},
    {"type": "multiple_choice",
     "q": S6 + "You plan to reduce human review of extractions. Which TWO practices should you put in place? (Select TWO.)",
     "opts": m({0, 1},
        "Have the model output field-level confidence scores and calibrate the review thresholds with a labeled validation set.",
        "Keep reviewing a stratified random sample of high-confidence extractions to measure error rates and catch new error patterns.",
        "Trust every extraction with a confidence score of 0.9 or higher from the first day.",
        "Review only the documents that customers complain about.",
        "Use the overall accuracy figure as the only criterion for reducing review."),
     "exp": "正解A・B。人のレビューを減らす準備。項目ごとの確信度を正解ラベル付きデータで調整し、高確信度の結果にも層化抽出の検査を続ける。C: 調整前の確信度は信頼できない。D: 苦情の出ない誤りを見逃す。E: 全体の精度は、特定の文書種類や項目の弱さを隠す。"},
]


def main():
    assert len(Q1) == 35, f"Q1 is {len(Q1)}"
    assert len(Q2E) == 30, f"Q2E is {len(Q2E)}"
    c = b.sb(env, "POST", "courses", {
        "title": "CCAR-F 合格対策 ｜ Claude認定試験 模擬問題集",
        "description": "Claude認定試験（CCAR-F）に合格するための模擬問題集コース。試験ガイドの出題項目をカバーした日本語35問と、本番形式の英語30問を、1問ずつ解いて解説で復習できます。合格ラインの目安は8割。何度でも受け直せます。",
        "status": "published", "is_sequential": False, "created_by": ADMIN_UUID})[0]
    se = b.sb(env, "POST", "sections", {
        "course_id": c["id"], "title": "模擬試験", "sort_order": 0})[0]
    sid = se["id"]
    print(f"講座『CCAR-F 合格対策』作成: {c['id']}")
    print(f"section_id: {sid}")

    lesson(sid, "CCAR-F とは・本番での解き方", INTRO, 0)
    quiz(sid, "第1弾 模擬問題 35問（日本語・解説付き）",
         "試験ガイドの出題項目30個を1問以上でカバー。8割(28/35)が合格目安。目安70分。", 1,
         Q1, passing=80, minutes=70)
    quiz(sid, "第2弾 模擬問題 30問（本番形式・英語）",
         "本番と同じ英語・シナリオ形式。第1弾で扱っていない論点と細かい判断。8割(24/30)が合格目安。目安60分。", 2,
         Q2E, passing=80, minutes=60)

    for uid in MEMBERS:
        b.sb(env, "POST", "enrollments", {"user_id": uid, "course_id": c["id"], "status": "active"})
    print(f"受講登録: {len(MEMBERS)}名")
    print(f"受講URL: /courses/{c['id']}")
    print("完成 🎓")


if __name__ == "__main__":
    main()
