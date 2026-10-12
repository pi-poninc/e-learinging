#!/usr/bin/env python3
"""CCAR-F 実装で理解するコース（support_agent.py / test_offline.py のコード解説＋問題）。

セクション1「コード解説」: 全体像 / ツール / フック / エージェントとループ / オフラインテスト（lesson×5）
セクション2「理解度チェック」: コード読解クイズ17問 ＋ ハンズオン課題
＋ 管理者・南條・小中 を受講登録

出典: ユーザー作成の support_agent.py（練習課題1）/ test_offline.py。
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ADMIN_UUID = "bab3dae7-813b-43ee-b7f9-200ca779dcfd"
MEMBERS = [ADMIN_UUID,
           "8936dff0-704d-4d2f-bff0-c84869eec0fc",
           "fd11370b-58d9-4d8c-b95b-bdd851515f34"]
sys.path.insert(0, str(ROOT / "content"))
import build as b  # noqa: E402

env = b.load_env()


def lesson(section_id, title, body, order):
    le = b.sb(env, "POST", "lessons", {
        "section_id": section_id, "title": title, "body": body,
        "sort_order": order, "status": "published"})[0]
    print(f"  lesson[{order}] {title}  {le['id']}")
    return le["id"]


def assignment(section_id, title, desc, order):
    a = b.sb(env, "POST", "assignments", {
        "section_id": section_id, "title": title, "description": desc,
        "sort_order": order, "status": "published"})[0]
    print(f"  assignment[{order}] {title}  {a['id']}")
    return a["id"]


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


def tfq(q, correct_bool, exp):
    return {"type": "true_false", "q": q, "exp": exp,
            "opts": [("○（正しい）", correct_bool), ("×（間違い）", not correct_bool)]}


# ===== レッスン本文 =====
L0 = r"""この2つのファイルは、**CCAR-F 練習課題1「エスカレーション付きの複数ツールエージェント」** を Claude Agent SDK（Python）で実装したものです。コードの各所に `[1.4]` のような印があり、試験ガイドの出題項目に対応しています。読めるようになれば、分野1〜5の“実務の判断”がそのまま身につきます。

## このプログラムは何をするか

オンラインストアの**カスタマーサポートAI**です。流れはこうです。

1. まず**顧客を特定・確認**する（get_customer）
2. **注文を照会**する（lookup_order）
3. 必要なら**返金**する（process_refund）
4. 自分で解決できない・ルール上できないときは**人へ引き継ぐ**（escalate_to_human）

## 2つのファイルの関係

| ファイル | 役割 |
|---|---|
| `support_agent.py` | 本体。ツール4つ・フック3つ・エージェント設定・システムプロンプト・実行ループ |
| `test_offline.py` | APIキー（＝AIモデル）なしで、**ツールとフックのロジックだけ**を確かめる確認用 |

`test_offline.py` は `import support_agent` して、関数を直接呼びます。モデルを介さないので、挙動が決定的で、お金もかかりません。

## 登場する部品（support_agent.py）

- **ダミーのバックエンド**: `CUSTOMERS`（顧客3人・うち2人は同姓同名）/ `ORDERS`（注文3件）/ `STATE`（セッション内の状態）
- **ツール4つ**: `get_customer` / `lookup_order` / `process_refund` / `escalate_to_human`
- **フック3つ**: `require_verified_customer`（本人確認ゲート）/ `enforce_refund_limit`（返金上限）/ `normalize_order_output`（形式そろえ）
- **エージェント設定**: `OPTIONS`（ClaudeAgentOptions）と `SYSTEM_PROMPT`
- **実行**: `run()` が1件の問い合わせを流し、`SCENARIOS` が4つの例

## 1件の問い合わせが流れる様子

```
ユーザー発話
   ↓
[エージェント] 何をすべきか考える → ツールを呼ぶ (tool_use)
   ↓  ← PreToolUse フック（本人確認済み？ 返金は上限内？）
[ツール] 実行して結果を返す
   ↓  → PostToolUse フック（日付・ステータスを読める形に変換）
[エージェント] 結果を見て、次のツール or 返答
   ↓  ... これを stop_reason が end_turn になるまで繰り返す [1.1]
最終返答
```

次のレッスンから、ツール → フック → エージェント → テスト の順に、コードを読んでいきます。
"""

L1 = r"""ツールは `@tool(名前, 説明文, 入力スキーマ)` で定義します。**モデルはこの「説明文」を手がかりにどのツールを呼ぶか決めます**。だから説明文の書き分けが、そのまま精度になります [2.1]。

## 共通の戻り値 ok() と err()

```python
def ok(payload):   # 成功。content 配列に JSON 文字列を入れて返す
    return {"content": [{"type": "text", "text": json.dumps(payload, ensure_ascii=False)}]}

def err(category, retryable, message):   # 構造化エラー [2.2]
    payload = {"errorCategory": category, "isRetryable": retryable, "message": message}
    return {"content": [...], "is_error": True}
```

ポイントは `err()`。「Operation failed」だけ返すと、エージェントは**再試行していいのか・顧客に何と言えばいいのか**を判断できません。だから、**種類（category）・再試行可否（isRetryable）・人が読める説明（message）** をそろえて返します [2.2]。

## get_customer — 人を特定・確認する

説明文に「**CUSTOMER（人）**を特定する」「毎回いちばん最初に使う」「IDは C-1234 形式」「**注文の照会には使うな（O-123 は lookup_order へ）**」と書いてあります。似たツールとの違いを明記するのが [2.1] の肝です。

中身の分岐は3つ：

```python
if not matches:                 return ok({"found": 0, "candidates": []})          # 該当なし＝正常 [2.2][5.3]
if len(matches) > 1:            return ok({"found": N, "verified": False, ...})     # 同姓同名→候補を返す
STATE["verified_customer_id"] = ...; return ok({"found": 1, "verified": True, ...}) # 1人だけ→確認済みに
```

- **該当なし（found=0）はエラーではなく正常な結果**。アクセス失敗（`is_error`）と区別します [2.2][5.3]。
- **同姓同名が複数**（Ken Sato が2人）なら、推測で選ばず候補を返し、`verified` にしません。→ メールかIDを聞く [5.2]。
- 1人に特定できたときだけ `STATE["verified_customer_id"]` に保存します。この状態を、あとでフックが見ます。

## lookup_order — 注文を照会する

```python
if not order_id.startswith("O-"):  return err("validation", False, ...)   # 形式エラー
if order_id == "O-503":            # 1回目だけ transient 失敗（障害のシミュレーション）
    STATE["flaky_calls"] += 1
    if STATE["flaky_calls"] == 1:  return err("transient", True, "... Retrying is safe.")
if order["customer_id"] != STATE["verified_customer_id"]:
                                   return err("permission", False, ...)   # 他人の注文
```

3種類のエラーが出ます。**validation / permission は再試行不可（False）**、**transient は再試行可（True）**。`O-503` は最初だけ失敗し、2回目で成功します。これで「isRetryable=True のときは1回再試行する」挙動を試せます。

## process_refund — 返金する

```python
if args["amount_usd"] > order["total_usd"]:
    return err("business", False, "... the maximum refundable amount is $...")
```

注文総額を超える返金は **business エラー（再試行不可）**。しかも「最大返金額は◯◯です」と、**顧客にそのまま伝えられる文**を返します [2.2]。

## escalate_to_human — 人へ引き継ぐ

入力スキーマが `customer_id / root_cause / amount_usd / recommended_action` の **object** で、主要項目が `required`。説明文に「**引き継ぎ先の人はこの会話を見られない。だから全項目を完結させよ**」とあります [1.4]。引き継ぎは、情報を落とさない構造化サマリーで渡すのが鉄則です。

> まとめ：ツールは「説明文で使い分けさせ [2.1]」「失敗は構造化して返す [2.2]」「該当なしは正常 [5.3]」「引き継ぎは完結したサマリー [1.4]」。
"""

L2 = r"""ツールの中にも if はありますが、**“絶対に守らせたい規則”はツール任せにせず、フックでコード側から強制**します。プロンプトの指示は、どれだけ強めても失敗率がゼロになりません [1.4][1.5]。

## フックが「拒否」を返す形

```python
def deny(input_data, reason):
    return {"hookSpecificOutput": {
        "hookEventName": input_data["hook_event_name"],
        "permissionDecision": "deny",
        "permissionDecisionReason": reason}}
```

`{}`（空）を返せば許可、`deny(...)` を返せばブロックです。

## ① require_verified_customer（PreToolUse：前提条件ゲート）

```python
if STATE["verified_customer_id"] is None:
    return deny(input_data, "Blocked: ... Call get_customer first ...")
return {}
```

本人確認（get_customer で1人に特定）が済むまで、**lookup_order と process_refund をブロック**します。「先に get_customer を呼べ」という理由も返すので、エージェントは次の行動が分かります。**なぜツール内のifでなくフックか**＝モデルがツールを呼ぶ“前”に、確実に止めたいからです [1.4]。

## ② enforce_refund_limit（PreToolUse：返金上限）

```python
amount = float(input_data["tool_input"].get("amount_usd", 0))
if amount > REFUND_LIMIT_USD:   # 500
    return deny(input_data, "Blocked by policy: ... need human approval. ... escalate_to_human ...")
```

**500ドルちょうどは許可、500.01ドルは拒否**（`>` なので境界は通る）。しかも「再試行するな、escalate_to_human を呼べ」と誘導します。金銭のように違反が1件も許されない規則は、コードで強制するのが正解です [1.4]。

## ③ normalize_order_output（PostToolUse：形式そろえ）

外部データは形式がばらばら。このフックは、**モデルが結果を見る“前”に**データをそろえます [1.5]。

```python
if isinstance(data.get("placed_at"), (int, float)):   # Unix時間 → ISO 8601
    data["placed_at"] = datetime.fromtimestamp(..., tz=timezone.utc).isoformat()
if isinstance(data.get("status"), int):               # 数値 → 名前
    data["status"] = STATUS_NAMES.get(data["status"], "unknown")
```

例えば `placed_at: 1789000000` は `2026-09-10T00:26:40+00:00` に、`status: 3` は `delivered` に変わります。`_map_text` が**文字列でも・contentブロックの配列でも・dictでも**同じように変換できるよう、再帰で処理しています（結果の形が違っても壊れない）。

## どのツールにどのフックが掛かるか

```python
hooks={
  "PreToolUse": [
    HookMatcher(matcher="...lookup_order|...process_refund", hooks=[require_verified_customer]),
    HookMatcher(matcher="...process_refund",                 hooks=[enforce_refund_limit]),
  ],
  "PostToolUse": [
    HookMatcher(matcher="...lookup_order", hooks=[normalize_order_output]),
  ],
}
```

`matcher` は正規表現。lookup_order と process_refund には本人確認ゲート、process_refund にはさらに上限チェック、lookup_order の結果には正規化が掛かります。

> まとめ：**確実さが要る規則はフックで強制**。前提条件ゲート（PreToolUse）/ 上限ブロック（PreToolUse）/ 形式そろえ（PostToolUse）。
"""

L3 = r"""ツールとフックを、1つのエージェントに組み立てます。

## ツールをサーバーにまとめる

```python
server = create_sdk_mcp_server(name="support", version="1.0.0",
    tools=[get_customer, lookup_order, process_refund, escalate_to_human])
P = "mcp__support__"   # ツール名の接頭辞（mcp__<サーバー名>__<ツール名>）
```

## ClaudeAgentOptions（エージェントの設定）

```python
OPTIONS = ClaudeAgentOptions(
    system_prompt=SYSTEM_PROMPT,
    mcp_servers={"support": server},
    tools=[],                    # 組み込みツールを外す
    allowed_tools=[f"{P}*"],     # 役割に必要な4つだけ許可 [2.3]
    setting_sources=[],          # 手元の CLAUDE.md や設定を読み込まない（挙動を固定）
    max_turns=15,
    hooks={...},                 # 前レッスンのフック
)
```

- `tools=[]` ＋ `allowed_tools=[f"{P}*"]` ＝ **組み込みツールを外し、自作の4ツールだけ**に絞る。ツールが多すぎると選択の信頼性が下がるからです [2.3]。
- `setting_sources=[]` ＝ 環境によって挙動が変わらないよう、手元の設定を読み込まない。
- `max_turns=15` ＝ 暴走の安全網（停止の“主”手段ではない。停止は stop_reason）。

## SYSTEM_PROMPT（判断ルールと例）

プロンプトには、コードでは縛れない“判断”を書きます。

- **エスカレーション基準**: 明確に人を求めたら→調査せず即引き継ぐ / ポリシー外 / 返金が上限超 / 進展できない
- **怒っているだけでは引き継がない**（受け止めて解決を申し出る）
- **ポリシー**: 破損・遅延は総額まで返金、それ以外は対象外
- 同姓同名は推測せず聞く / 複数用件は全部処理して1つにまとめて回答 / `isRetryable` が true のときだけ1回再試行
- **few-shot の例**を3つ（通常の返金 / 人を要求 / 競合価格合わせ＝ポリシー外で引き継ぎ）

コード（フック）とプロンプトの役割分担が肝心です。**絶対の規則はフック**、**状況に応じた判断はプロンプト**。

## 実行ループ run()

```python
async with ClaudeSDKClient(options=OPTIONS) as client:
    await client.query(prompt)
    async for message in client.receive_response():
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if   isinstance(block, ToolUseBlock): print("[tool]", block.name, ...)
                elif isinstance(block, TextBlock):    print("AGENT:", block.text)
        elif isinstance(message, ResultMessage):
            print("(stop_reason=", message.stop_reason, ...)
```

SDK が **stop_reason を見てループを回します**。`tool_use` なら継続（ツールを実行して次へ）、`end_turn` で終了 [1.1]。各ターンで、エージェントのツール呼び出し（ToolUseBlock）と発話（TextBlock）を表示し、最後に ResultMessage で停止理由とターン数を出します。

実行の冒頭で `STATE` を初期化（`verified_customer_id=None, flaky_calls=0`）しているので、シナリオごとに状態がリセットされます。

> まとめ：**ツールは必要な分だけに絞り [2.3]**、**絶対の規則はフック・判断はプロンプト**、**ループは stop_reason で回す [1.1]**。
"""

L4 = r"""`test_offline.py` は、**APIキー（AIモデル）なし**で、ツールとフックの**ロジックだけ**を確かめます。モデルを介さないので、結果が毎回同じ（決定的）で、費用もかかりません。

## 呼び方のコツ

```python
import support_agent as s
r = await s.get_customer.handler({"identifier": "C-1001"})   # ツールは .handler を直接呼ぶ
out = await s.require_verified_customer({**pre, "tool_input": {}}, None, None)  # フックは dict を渡す
def body(result): return json.loads(result["content"][0]["text"])  # content の中の JSON を取り出す
```

ツールの実体は `.handler`。フックには `hook_event_name` などを入れた dict を渡します。

## 7つのチェックの意味

1. **前提条件ゲート**: 本人確認“前”は deny、get_customer で確認“後”は `{}`（許可）。
2. **同姓同名**: "Ken Sato" は `found==2`、かつ `verified_customer_id` は None のまま（確認しない）。
3. **該当なし**: "nobody" は `found==0` で、`is_error` を**含まない**（正常な結果）。
4. **返金上限**: 500 は許可（`{}`）、500.01 は deny。
5. **一時エラー**: `O-503` の1回目は `transient / isRetryable=True`、2回目は `found==1`（成功）。
6. **再試行不可のエラー**: `validation`（"501"＝O-無し）・`permission`（他人の注文）・`business`（総額超の返金）はいずれも `isRetryable=False`。
7. **正規化**: `placed_at:1789000000, status:3` を、**文字列／contentブロック配列／dict のどの形**で渡しても、`2026-09-10T...` と `delivered` に変換され、元の `1789000000` は消える。

すべて通ると `OK: 7 checks passed` と出ます。

## なぜこのテストが価値を持つか

エージェントの“判断”はモデル任せで揺れますが、**ツールとフックのロジックは決定的**です。だからここを単体テストで固めておけば、モデルを呼ぶ本番のコストと揺らぎを避けて、土台の正しさを保証できます。これは試験が問う「信頼性」の実践そのものです。

## 動かしてみる

```bash
pip install claude-agent-sdk     # test_offline も support_agent を import するので必要
python test_offline.py           # → OK: 7 checks passed
export ANTHROPIC_API_KEY=...      # 本番（モデルを使う）
python support_agent.py          # 4シナリオを実行
python support_agent.py "自由な問い合わせ文"
```

> まとめ：**決定的なロジックはモデル抜きで単体テスト**。7チェックが、ツールとフックの要件を1つずつ保証している。
"""

# ===== 理解度チェック 17問 =====
QUIZ = [
    {"type": "single_choice", "q": "get_customer に \"Ken Sato\"（同姓同名が2件）を渡すと、どうなる？",
     "opts": s(1,
        "最初に一致した顧客を選び、確認済み（verified）にする",
        "found=2 の候補一覧を返し、確認済みにしない（メールかIDを聞く）",
        "is_error=True のエラーを返す",
        "両方の顧客に返金できるようにする"),
     "exp": "候補が複数なら推測で選ばない [5.2]。verified にしないので、後続のツールはフックにブロックされる。"},
    {"type": "single_choice", "q": "get_customer に該当なし（\"nobody\"）を渡したときの戻り値は？",
     "opts": s(1,
        "is_error=True のエラー",
        "found=0 の正常な結果（is_error は含まない）",
        "例外を投げる",
        "空文字列"),
     "exp": "「該当なし」は正常な結果。アクセス失敗（is_error）とは区別する [2.2][5.3]。"},
    {"type": "single_choice", "q": "本人確認（verified_customer_id）のチェックを、lookup_order 内の if ではなくフック require_verified_customer で行うのはなぜ？",
     "opts": s(1,
        "コードが短くなるから",
        "確実に守らせたい前提条件は、モデルがツールを呼ぶ前にフックでコード強制するため [1.4]",
        "フックのほうが実行が速いから",
        "ツール内から STATE を読めない仕様だから"),
     "exp": "前提条件ゲート。プロンプトやツール任意実装は失敗率がゼロにならないので、コードで止める。"},
    {"type": "single_choice", "q": "lookup_order(\"O-503\") を初めて呼ぶと？",
     "opts": s(1,
        "必ず成功して注文を返す",
        'errorCategory="transient", isRetryable=True のエラー（1回目だけ失敗）',
        'errorCategory="permission" のエラー',
        "found=0"),
     "exp": "一時障害のシミュレーション。flaky_calls==1 で失敗、2回目で成功。isRetryable=True なので1回再試行してよい。"},
    {"type": "single_choice", "q": "enforce_refund_limit に amount_usd=500 と 500.01 を渡すと、それぞれどうなる？",
     "opts": s(2,
        "両方とも許可",
        "両方とも拒否",
        "500 は許可、500.01 は拒否",
        "500 は拒否、500.01 は許可"),
     "exp": "判定は `> REFUND_LIMIT_USD`(500)。ちょうど500は境界で通り、超過は拒否して escalate_to_human へ誘導する。"},
    {"type": "single_choice", "q": "normalize_order_output（PostToolUse フック）は、いつ・何をする？",
     "opts": s(1,
        "モデルが結果を見た後に、ログを残す",
        "モデルが結果を見る前に、placed_at（Unix時間）を ISO 8601 に、status（数値）を名前に変換する [1.5]",
        "ツールを呼ぶ前に、入力を検証する",
        "返金額を丸める"),
     "exp": "外部データの形式ゆれを、モデルが処理する前にそろえる。例: 1789000000→2026-09-10T...、3→delivered。"},
    tfq("tools=[] と allowed_tools=[f\"{P}*\"] は、組み込みツールを外して自作の4ツールだけに絞るための設定である。", True,
        "○。ツールが多すぎると選択の信頼性が下がるので、役割に必要な分だけにする [2.3]。"),
    {"type": "single_choice", "q": "process_refund に、注文総額を超える amount_usd を渡すと？",
     "opts": s(1,
        "成功して全額返金する",
        'errorCategory="business", isRetryable=False のエラー（最大返金額を顧客に伝える文つき）',
        "transient エラーで再試行される",
        "フックがブロックする"),
     "exp": "業務ルール違反。再試行不可で、顧客にそのまま伝えられる説明（最大返金額）を返す [2.2]。"},
    {"type": "single_choice", "q": "SYSTEM_PROMPT によれば、「怒っているが、こちらで解決できる」顧客にはどう対応する？",
     "opts": s(2,
        "すぐにエスカレーションする",
        "感情分析のスコアで引き継ぐか決める",
        "不満を受け止め、解決を申し出る（怒りだけではエスカレーションしない）",
        "本人確認を3回求める"),
     "exp": "A frustrated tone alone is NOT a reason to escalate。感情は引き継ぎの基準にしない。"},
    {"type": "single_choice", "q": "顧客が「人（人間の担当者）と話したい」と明確に言ったら？",
     "opts": s(1,
        "まず問題を調査してから、必要ならエスカレーションする",
        "調査を挟まず、直ちに escalate_to_human を呼ぶ",
        "住所変更など、すぐ終わる用件は先に片付ける",
        "自分で解決できると説得する"),
     "exp": "explicitly asks for a human → escalate immediately, without investigating first。"},
    {"type": "single_choice", "q": "escalate_to_human が customer_id / root_cause / recommended_action を必須にしているのはなぜ？",
     "opts": s(1,
        "ログを見やすくするため",
        "引き継ぎ先の人はこの会話を見られないので、全項目を完結させる必要があるから [1.4]",
        "SDK が必須にしているから",
        "返金額を自動計算するため"),
     "exp": "The human CANNOT see this conversation。情報を落とさない構造化サマリーで渡す。"},
    {"type": "single_choice", "q": "確認済みの顧客とは別の顧客の注文IDを lookup_order に渡すと？",
     "opts": s(1,
        "正常に注文を返す",
        'errorCategory="permission", isRetryable=False のエラー',
        "found=0",
        "transient エラー"),
     "exp": 'order["customer_id"] != verified_customer_id のとき permission エラー（再試行不可）。'},
    {"type": "multiple_choice", "q": "err() が返す辞書の特徴として正しいものを2つ選べ。（2つ選択）",
     "opts": m({0, 1},
        "is_error=True を含む",
        "errorCategory・isRetryable・message を持つ",
        "HTTP ステータスコードを含む",
        "必ず再試行される",
        "content を持たない"),
     "exp": "構造化エラー [2.2]。種類・再試行可否・人が読める説明をそろえるから、エージェントが回復を判断できる。"},
    {"type": "single_choice", "q": "test_offline.py が s.get_customer.handler(...) と .handler を直接呼び、フックには dict を渡しているのはなぜ？",
     "opts": s(0,
        "APIキーとモデルなしで、ツールとフックのロジックだけを決定的に検証するため",
        "本番より実行が速いから",
        "SDK がオフライン実行を強制するから",
        "モデルの出力同士を比較するため"),
     "exp": "ロジックは決定的なので、モデルを介さず単体テストできる。費用も揺らぎもない。"},
    {"type": "single_choice", "q": "run() の receive_response ループで、SDK がツール実行の継続と終了を切り替える判断材料は？",
     "opts": s(2,
        "経過したターン数",
        "応答にテキストが含まれているか",
        "stop_reason（tool_use なら継続、end_turn で終了）[1.1]",
        "ユーザーの再入力"),
     "exp": "ループ制御は stop_reason で判定する。テキストの有無や回数で判定しない。"},
    {"type": "single_choice", "q": "OPTIONS の setting_sources=[] は何のため？",
     "opts": s(0,
        "手元の CLAUDE.md や個人設定を読み込まず、挙動を固定（再現可能に）するため",
        "ログ出力を止めるため",
        "すべてのツールを無効化するため",
        "セッションを保存しないため"),
     "exp": "環境によって挙動が変わらないよう、外部設定を読み込まない。"},
    tfq("_map_text は、ツール結果が「文字列」「content ブロックの配列」「dict」のどの形でも text を変換できるよう、再帰的に処理している。", True,
        "○。結果の形が違っても壊れないよう、再帰で text/content を辿って normalize_order_text を適用する。"),
]

ASSIGN = r"""コードを「読める」から「書ける」へ進めるハンズオン課題です。`support_agent.py` と `test_offline.py` を手元にコピーして取り組んでください（`pip install claude-agent-sdk` が必要です。APIキーがなくても `test_offline.py` は動きます）。

## 必須課題（どれか1つ以上）

**A. 新しいツールを1つ足す**
例: `get_order_history(customer_id)` = 確認済み顧客の注文一覧を返すツール。
- `@tool(...)` で、説明文に「いつ使うか・似たツールとの違い」を書く [2.1]。
- 成功は `ok(...)`、失敗は `err(category, retryable, message)` で返す [2.2]。
- `create_sdk_mcp_server` の tools に追加する。

**B. 新しいフック（規則）を1つ足す**
例: 「status が processing（＝未発送）の注文は返金できない」を PreToolUse フックで強制する。
- `deny(input_data, 理由)` でブロックし、理由も返す [1.4]。
- `HookMatcher` で process_refund に掛ける。

## 検証（必須）

`test_offline.py` に、追加した機能のテストを**最低1つ**足して、`python test_offline.py` が
`OK: N checks passed`（Nが増える）で通ることを確認する。
- ツールは `s.<tool>.handler({...})` を await で呼ぶ。
- フックは `s.<hook>({**pre, "tool_input": {...}}, None, None)` を await で呼ぶ。
- `body(result)` で content の中の JSON を取り出す。

## 提出するもの

1. 追加・変更したコード（diff でも全文でも可）
2. `python test_offline.py` の実行結果（`OK: ... passed` の行）
3. **ひとことで**: あなたの追加は、試験項目のどれ（例 [2.1][1.4][2.2]）に対応するか

## 評価の観点

- 説明文で使い分けができているか [2.1] / 失敗を構造化して返しているか [2.2]
- 「絶対の規則はフック、状況判断はプロンプト」の分担になっているか [1.4]
- 追加機能にテストが付いていて、決定的に検証できているか
"""


def main():
    assert len(QUIZ) == 17
    c = b.sb(env, "POST", "courses", {
        "title": "CCAR-F 実装で理解する ｜ サポートエージェントのコード",
        "description": "練習課題1の実装（support_agent.py / test_offline.py）を1行ずつ読み解くコース。ツール設計・フックによる規則の強制・エージェントのループ・オフラインテストを、試験の出題項目に結びつけて理解します。コード解説レッスン＋理解度チェック17問＋ハンズオン課題。",
        "status": "published", "is_sequential": False, "created_by": ADMIN_UUID})[0]
    print(f"講座作成: {c['id']}")

    sec1 = b.sb(env, "POST", "sections", {
        "course_id": c["id"], "title": "コード解説", "sort_order": 0})[0]["id"]
    print(f"section1: {sec1}")
    lesson(sec1, "① このプログラムの全体像", L0, 0)
    lesson(sec1, "② ツールの設計を読む（get_customer ほか）", L1, 1)
    lesson(sec1, "③ フックで規則を強制する（PreToolUse / PostToolUse）", L2, 2)
    lesson(sec1, "④ エージェントの組み立てと実行ループ", L3, 3)
    lesson(sec1, "⑤ test_offline.py を読む（APIキーなしで検証）", L4, 4)

    sec2 = b.sb(env, "POST", "sections", {
        "course_id": c["id"], "title": "理解度チェック", "sort_order": 1})[0]["id"]
    print(f"section2: {sec2}")
    quiz(sec2, "コード読解クイズ 17問",
         "support_agent.py / test_offline.py の挙動を理解できたか確認する。解説付き。", 0, QUIZ, passing=80)
    assignment(sec2, "ハンズオン：ツール or ルールを1つ足してテストする", ASSIGN, 1)

    for uid in MEMBERS:
        b.sb(env, "POST", "enrollments", {"user_id": uid, "course_id": c["id"], "status": "active"})
    print(f"受講登録: {len(MEMBERS)}名")
    print(f"受講URL: /courses/{c['id']}")
    print("完成 🎓")


if __name__ == "__main__":
    main()
