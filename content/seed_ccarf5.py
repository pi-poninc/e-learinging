#!/usr/bin/env python3
"""CCAR-F 実装で理解する③（extraction_pipeline.py / test_extraction_offline.py 解説＋問題）。"""
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


L0 = r"""この2ファイルは、**CCAR-F 練習課題3「構造化データ抽出のパイプライン」** を実装したものです。請求書のような文書から、決まった形のデータを**確実に**取り出します。対応は分野4・5。

## このプログラムは何をするか

1. **スキーマ**を決める（必須/任意・列挙+other・nullable）[4.3]
2. 文書から抽出し、スキーマで**検証**する。ダメなら**検証エラーを添えて再試行** [4.4]
3. **確信度**が低い／新種の文書は**人のレビューへ** [5.5]
4. 大量の文書を**バッチ**で流し、**失敗分だけ再提出** [4.5]

## 2ファイルの関係

| ファイル | 役割 |
|---|---|
| `extraction_pipeline.py` | スキーマ・検証・再試行・確信度ルーティング・バッチ・抽出ツール |
| `test_extraction_offline.py` | APIキー（モデル）なしでロジックを検証（`OK: 7 checks passed`） |

## 役割分担がこの課題の肝

- **モデルがやること**: 文書を読んで値を“抽出”する（揺れる）
- **コード（決定的）がやること**: スキーマ検証・再試行の制御・確信度での振り分け・バッチと再提出

揺れる部分（抽出）と、揺れてはいけない部分（検証・制御）を分けるのが設計の芯です。だから後者は**モデル抜きで単体テスト**できます。

## 流れの図

```
文書(raw)
  ↓ extract（モデルの代役：決定的）
record（候補）
  ↓ validate（スキーマ違反は？）[4.3]
 ┌ エラーあり → エラーを添えて再試行（形式の誤りは直る／欠落は直らない）[4.4]
 └ エラーなし → route_for_review（低確信度/other は人へ）[5.5]
  ↓ run_batch（custom_id で管理、失敗分だけ resubmit）[4.5]
確定レコード ＋ 人のレビュー待ち ＋ 失敗
```

次から、スキーマ → 抽出と再試行 → 確信度とバッチ → テスト の順に読みます。
"""

L1 = r"""抽出の“ゴールの形”を、1か所のスキーマで決めます。

## SCHEMA（必須/任意・列挙+other・nullable）

```python
SCHEMA = {
  "invoice_id":      {"type":"str",    "required":True},
  "total":           {"type":"number", "required":True},
  "issued_date":     {"type":"date",   "required":True},   # ISO 8601 (YYYY-MM-DD)
  "po_number":       {"type":"str",    "required":False, "nullable":True},  # 無ければ null（捏造しない）
  "category":        {"type":"enum",   "required":True, "values":CATEGORIES, "other":True},
  "category_detail": {"type":"str",    "required":False, "nullable":True},
  "confidence":      {"type":"number", "required":True},
}
```

3つの設計判断が [4.3] の肝です。

- **nullable（po_number）**: 発注番号は文書に無いことがある。**必須にすると、モデルは“もっともらしい番号を捏造”して埋めます**。任意＋nullable にして `null` を返せるようにする。
- **列挙 + other（category）**: 既知の6種は列挙で縛る。新種の文書が来たら、無理に6種へ押し込まず **`other` ＋ `category_detail`** に逃がす（下流で集計が壊れない）。
- **必須（invoice_id / total / issued_date）**: これらが無いレコードは通さない。

## validate — 何を防ぎ、何を防がないか

```python
def validate(rec):
    # 必須欠落 / 型違い / 日付が ISO 8601 でない / 列挙外 を検出
    # category == "other" のときは category_detail を必須にする
    ...
```

`validate` が防ぐのは **“形式”の誤り**（構文・型・列挙・必須）です。**「明細の合計が総額と合わない」ような“意味”の誤りは、スキーマでは防げません** [4.4]。意味の検証は別に入れます（例：計算値と記載値の突き合わせ）。ここを混同しないのが頻出の落とし穴です。

> まとめ：**捏造を防ぐため任意項目は nullable [4.3]**、**新種は other に逃がす [4.3]**、**スキーマが守るのは形式だけ・意味は別 [4.4]**。
"""

L2 = r"""抽出と、失敗したときの**再試行ループ**を読みます。

## extract — モデルの代役（決定的）

本物ではモデルが文書を読みますが、テストできるよう、ここでは決定的な代役にしています。ポイントは2つ。

```python
# total "¥1,200.00"（文字列）は、再試行の指摘(feedback)が来たら数値化
rec["total"] = float(re.sub(r"[^\d.]","", total)) if feedback else total
# issued_date "2026/03/04" は、再試行で "2026-03-04" に
rec["issued_date"] = d.replace("/","-") if feedback else d
# 発注番号は文書になければ None（捏造しない）
rec["po_number"] = raw.get("po_number")
# 未知の分類は other ＋ detail
```

## extract_with_retry — 検証エラーを添えて再試行 [4.4]

```python
def extract_with_retry(raw, max_retries=2):
    feedback = None
    for attempt in range(max_retries + 1):
        rec = extract(raw, feedback)
        errors = validate(rec)
        if not errors:
            return {"ok": True, "record": rec, "attempts": attempt + 1}
        feedback = errors        # ← このエラーを添えて、もう一度やらせる
    return {"ok": False, "errors": errors, "attempts": max_retries + 1}
```

ここが課題3の心臓部です。**検証でダメだったら、そのエラー内容を添えてもう一度**抽出させる。

- **形式の誤り**（`¥1,200.00`→`1200.0`、`2026/03/04`→`2026-03-04`）は、再試行で**直ります**。
- **情報がそもそも文書に無いもの**（`invoice_id` 欠落）は、**何度再試行しても直りません**。モデルは存在しない情報を生み出せない（生み出したら捏造）。だから `ok=False` で返し、人のレビューへ回します [4.4]。

この「再試行が効くのは形式/構造、情報欠落は効かない」は、試験で繰り返し問われる分かれ目です。

## 抽出ツール

```python
@tool("extract_invoice", "... If a required value is not present, leave it null — never invent it. ...", {"document": dict})
async def extract_invoice(args):
    out = extract_with_retry(args["document"])
    if out["ok"]: return ok({"record": out["record"], "review": route_for_review(out["record"])})
    return err("validation", False, "... missing data cannot be fabricated. ... Route to human review.")
```

ツールの説明文にも「無ければ null、捏造するな」と明記します [4.3]。

> まとめ：**検証エラーを添えて再試行 [4.4]**、**形式は直る・欠落は直らない（捏造しない）[4.4]**。
"""

L3 = r"""確定・レビュー・バッチの振り分けを読みます。ここは全部、モデルを介さない決定的なコードです。

## route_for_review — 人のレビューに回す [5.5]

```python
def route_for_review(rec, threshold=0.8):
    reasons = []
    if rec.get("confidence", 0) < threshold: reasons.append("low_confidence")
    if rec.get("category") == "other":       reasons.append("category_other")
    return reasons   # 空なら自動確定
```

- **確信度が低い**ものは人が見る。
- **`other`（新種の文書）**は、確信度が高くても人が見る。

重要な前提：**確信度は、正解ラベル付きデータで調整（calibrate）して初めて信頼できます** [5.5]。「全体の精度が高いから」で一律に人のレビューを外すのは危険で、種類別・項目別に見て、高確信度でも層化抽出で検査を続けます。

## run_batch / resubmit_failures — バッチと再提出 [4.5]

```python
def run_batch(docs):                 # docs = {custom_id: raw}
    for cid, raw in docs.items():
        if len(json.dumps(raw)) > MAX_DOC_CHARS:        # 大きすぎ＝失敗（上限超の模擬）
            results[cid] = {"status":"failed","errorCategory":"too_large"}; failed.append(cid); continue
        out = extract_with_retry(raw)
        ...（ok なら record＋review、ダメなら failed）
    return {"results": results, "failed": failed}

def resubmit_failures(docs, failed_ids):
    return run_batch({cid: docs[cid] for cid in failed_ids if cid in docs})  # 失敗分だけ
```

- **`custom_id`** でリクエストと結果を対応づけます。これがあるから、**失敗した分だけ**を特定して再提出できます（全1,000件をやり直さない）[4.5]。
- 大きすぎる文書（コンテキスト上限の模擬）は失敗にして `failed` へ。再提出時は分割して渡す前提です。

> まとめ：**低確信度/other は人へ [5.5]**、**確信度は調整して初めて使える [5.5]**、**custom_id で失敗分だけ再提出 [4.5]**。
"""

L4 = r"""`test_extraction_offline.py` は、**モデルなし**でパイプラインのロジックを検証します（`OK: 7 checks passed` を実機確認済み）。

## 7つのチェックの意味

1. **検証OK**: 完全に正しいレコードは `validate` がエラー0。
2. **検証NG**: 必須欠落・型違い（total が文字列）・日付形式（スラッシュ）・列挙外 を検出 [4.3][4.4]。
3. **nullable**: `po_number` が無ければ `None` のままで有効（捏造しない）[4.3]。
4. **列挙 + other**: 未知分類は `other` ＋ `category_detail` になり、有効 [4.3]。
5. **再試行**: `¥1,200.00`・`2026/03/04` は再試行で `1200.0`・`2026-03-04` に直る。`invoice_id` 欠落は再試行でも `ok=False`（直らない）[4.4]。
6. **確信度ルーティング**: 高確信度の既知分類は自動確定、低確信度／`other` はレビュー行き [5.5]。
7. **バッチ**: `doc-4`（必須欠落）は `failed`。`resubmit_failures` は**失敗分だけ**処理。`extract_invoice` ツールは直らないものに構造化エラーを返す [4.4][4.5]。

## 動かす

```bash
pip install claude-agent-sdk
python test_extraction_offline.py     # → OK: 7 checks passed
python extraction_pipeline.py         # バッチ処理と再提出のデモ（モデル不要）
python extraction_pipeline.py agent   # モデルを使う抽出（要 ANTHROPIC_API_KEY）
```

> まとめ：**揺れない部分（検証・再試行・ルーティング・バッチ）は決定的に書いて単体テスト**。7チェックが課題3の要件を1つずつ保証する。
"""

QUIZ = [
    {"type": "single_choice", "q": "SCHEMA で po_number はどう定義されている？またその理由は？",
     "opts": s(1,
        "required=True。発注番号は必ずあるから",
        "required=False, nullable=True。無ければ null を返し、捏造を防ぐため [4.3]",
        "enum。決まった番号しか来ないから",
        "type=number。番号は数値だから"),
     "exp": "必須にするとモデルがもっともらしい番号を捏造する。任意＋nullable にして null を返せるようにする [4.3]。"},
    {"type": "single_choice", "q": "validate が検出できる誤りと、できない誤りの組み合わせは？",
     "opts": s(0,
        "検出できる＝必須欠落・型違い・日付形式・列挙外／できない＝明細合計と総額の不一致などの意味の誤り",
        "検出できる＝意味の誤り／できない＝形式の誤り",
        "すべての誤りを検出できる",
        "何も検出できない"),
     "exp": "スキーマが防ぐのは形式（構文・型・列挙・必須）だけ。意味上の誤りは別に検証する [4.4]。"},
    {"type": "single_choice", "q": 'extract_with_retry に total="¥1,200.00"、issued_date="2026/03/04" の文書を渡すと？',
     "opts": s(2,
        "形式が違うので必ず失敗する",
        "そのままの文字列で確定する",
        "再試行で total=1200.0、issued_date=\"2026-03-04\" に直って成功する",
        "人のレビューに回る"),
     "exp": "形式の誤りは、検証エラーを添えた再試行で直る [4.4]。"},
    {"type": "single_choice", "q": "invoice_id（必須）が文書に無いとき、extract_with_retry はどうなる？",
     "opts": s(1,
        "もっともらしい invoice_id を作って成功する",
        "再試行しても直らず ok=False（情報が無いものは捏造しない）[4.4]",
        "1回目で必ず成功する",
        "例外を投げる"),
     "exp": "再試行が効くのは形式/構造の誤り。情報がそもそも無いものは何度やっても直らない。捏造せず人へ回す [4.4]。"},
    {"type": "single_choice", "q": '未知の分類 category="delivery note" を抽出すると？',
     "opts": s(1,
        "既存の6分類のどれかに無理やり入れる",
        'category="other"、category_detail="delivery note" になり、検証も通る [4.3]',
        "検証エラーで失敗する",
        "confidence が 0 になる"),
     "exp": "新種は6分類へ押し込まず other ＋ detail に逃がす。下流の集計が壊れない [4.3]。"},
    {"type": "single_choice", "q": "route_for_review が人のレビューに回す条件は？",
     "opts": s(1,
        "総額が一定額を超えたとき",
        "確信度が閾値(0.8)未満、または category が other のとき [5.5]",
        "必ず全件",
        "po_number が null のとき"),
     "exp": "低確信度、または新種(other)は人が見る。高確信度の既知分類は自動確定 [5.5]。"},
    {"type": "single_choice", "q": "run_batch で、サイズが大きすぎる文書はどう扱われる？",
     "opts": s(1,
        "自動で要約してから処理する",
        'errorCategory="too_large" で failed に入る（コンテキスト上限の模擬）[4.5]',
        "確信度を下げて処理する",
        "無視される"),
     "exp": "大きすぎる文書は失敗扱い。再提出時は分割して渡す前提 [4.5]。"},
    {"type": "single_choice", "q": "resubmit_failures は何を処理する？",
     "opts": s(1,
        "全件をもう一度処理する",
        "failed の custom_id の文書だけを処理する [4.5]",
        "成功した分だけを処理する",
        "ランダムに半分を処理する"),
     "exp": "custom_id で失敗分を特定し、そこだけ再提出。全件やり直さない [4.5]。"},
    {"type": "single_choice", "q": "extract_invoice ツールが、再試行しても有効にできない文書に返すものは？",
     "opts": s(1,
        "空の成功結果",
        "構造化エラー（is_error=True）＋「人のレビューへ」という指示 [4.4]",
        "もっともらしく埋めた record",
        "例外"),
     "exp": "情報が無いものは捏造せず、構造化エラーで人のレビューに回す [4.4]。"},
    {"type": "single_choice", "q": 'category が "other" のとき、追加で必須になる項目は？',
     "opts": s(2, "po_number", "confidence", "category_detail", "issued_date"),
     "exp": "other のときは category_detail（何の文書か）を必須にする。空だと検証エラー [4.3]。"},
    {"type": "single_choice", "q": 'confidence=0.99 でも category=="other" のレコードは？',
     "opts": s(1,
        "自動確定する",
        "category_other としてレビュー行きになる [5.5]",
        "確信度が高いので無条件に信頼する",
        "検証エラーになる"),
     "exp": "新種(other)は、確信度が高くても人が見る。確信度だけで外さない [5.5]。"},
    {"type": "single_choice", "q": "必須だった項目が文書に無いとき、もし required=True のままにすると何が起きる？",
     "opts": s(0,
        "モデルがもっともらしい値を捏造して埋める",
        "必ず null が入る",
        "自動的に正しい値が補完される",
        "何も起きない"),
     "exp": "必須のままだと、情報が無くても“何か”を埋めるしかなくなる＝捏造。だから任意＋nullable にする [4.3]。"},
    {"type": "single_choice", "q": "検証エラーを添えた再試行で直せるのは、どんな誤りか？",
     "opts": s(1,
        "文書に存在しない情報の欠落",
        "形式や構造の誤り（型・日付形式・列挙外など）",
        "どんな誤りも直せる",
        "意味の矛盾（合計の不一致）だけ"),
     "exp": "再試行が効くのは形式/構造。情報が無いものは生み出せない（捏造になる）[4.4]。"},
    {"type": "single_choice", "q": "test_extraction_offline.py が純関数やツール .handler を直接呼ぶ理由は？",
     "opts": s(0,
        "モデルなしで、検証・再試行・ルーティング・バッチを決定的に検証するため",
        "本番より速いから",
        "SDK がオフラインを強制するから",
        "モデルの出力同士を比較するため"),
     "exp": "揺れてはいけない部分（検証・制御）を、モデル抜きで単体テストできる。"},
    {"type": "single_choice", "q": "バッチの custom_id の役割は？",
     "opts": s(1,
        "確信度を上げる",
        "リクエストと結果を対応づけ、失敗分だけ再提出できるようにする [4.5]",
        "文書を暗号化する",
        "処理順を決める"),
     "exp": "custom_id で結果を突き合わせ、failed だけを特定して再提出する [4.5]。"},
    tfq("tool_use と JSON スキーマを使えば、明細の合計が総額と合わないような“意味上”の誤りも防げる。", False,
        "×。スキーマが防ぐのは構文・形式の誤りだけ。意味の誤りは、計算値と記載値を突き合わせるなど別に検証する [4.4]。"),
    tfq("発注番号を必須項目のままにすると、文書に無いときにモデルがもっともらしい番号を捏造しうる。だから任意＋nullable にする。", True,
        "○。必須のままでは“何か”を埋めるしかなくなる。nullable にして null を返せるようにする [4.3]。"),
]

ASSIGN = r"""`extraction_pipeline.py` / `test_extraction_offline.py` を手元にコピーして取り組んでください（`pip install claude-agent-sdk`。APIキーなしで `test_extraction_offline.py` は動きます）。

## 必須課題（どれか1つ以上）

**A. スキーマに項目を1つ足す**
例: `currency`（enum: JPY/USD/EUR ＋ other）や `tax`（number, nullable）を SCHEMA に足し、`validate` と `extract` を対応させる。

**B. 意味の検証を1つ足す**
スキーマでは防げない“意味”の誤りを1つ検出する関数を足す。例: `line_items` の合計と `total` が一致するかを確認し、食い違えばレビュー理由に `total_mismatch` を足す [4.4]。

**C. 確信度ルーティングを調整する**
`route_for_review` に、項目別のしきい値（例: total だけ厳しく）や、`po_number` が null のときの注記などを足す [5.5]。

## 検証（必須）

`test_extraction_offline.py` に、追加した機能のテストを**最低1つ**足して、`python test_extraction_offline.py` が
`OK: N checks passed` で通ることを確認する。
- ツールは `e.extract_invoice.handler({"document": {...}})` を await で呼ぶ。
- 純関数は `e.validate(...)` / `e.extract_with_retry(...)` / `e.run_batch(...)` のように直接呼ぶ。

## 提出するもの
1. 追加・変更したコード 2. `python test_extraction_offline.py` の結果 3. ひとこと：対応する試験項目（例 [4.3][4.4][5.5]）

## 評価の観点
- 必須/任意・列挙+other・nullable を正しく扱えているか [4.3]
- 形式の誤りは再試行で直し、情報欠落は捏造せず人へ回せているか [4.4]
- 確信度での振り分け・失敗分だけの再提出ができているか [5.5][4.5]
"""


def main():
    assert len(QUIZ) == 17
    c = b.sb(env, "POST", "courses", {
        "title": "CCAR-F 実装で理解する ③ ｜ 構造化データ抽出パイプライン",
        "description": "練習課題3の実装（extraction_pipeline.py / test_extraction_offline.py）を読み解くコース。必須/任意・列挙+other・nullable を含むスキーマ、検証エラーを添えた再試行、確信度での人のレビュー振り分け、バッチと失敗分だけの再提出を、試験の出題項目に結びつけて理解します。解説5本＋コード読解17問＋ハンズオン課題。オフラインテストはSDK導入環境で動作確認済み。",
        "status": "published", "is_sequential": False, "created_by": ADMIN_UUID})[0]
    print(f"講座作成: {c['id']}")
    sec1 = b.sb(env, "POST", "sections", {"course_id": c["id"], "title": "コード解説", "sort_order": 0})[0]["id"]
    print(f"section1: {sec1}")
    lesson(sec1, "① このプログラムの全体像", L0, 0)
    lesson(sec1, "② スキーマ設計（必須/任意・列挙+other・nullable）", L1, 1)
    lesson(sec1, "③ 抽出と再試行ループ（形式は直る・欠落は捏造しない）", L2, 2)
    lesson(sec1, "④ 確信度ルーティングとバッチ（失敗分だけ再提出）", L3, 3)
    lesson(sec1, "⑤ test_extraction_offline.py を読む", L4, 4)
    sec2 = b.sb(env, "POST", "sections", {"course_id": c["id"], "title": "理解度チェック", "sort_order": 1})[0]["id"]
    print(f"section2: {sec2}")
    quiz(sec2, "コード読解クイズ 17問",
         "extraction_pipeline.py / test_extraction_offline.py の挙動を理解できたか確認する。解説付き。", 0, QUIZ, passing=80)
    assignment(sec2, "ハンズオン：スキーマ or 意味検証 or ルーティングを足してテストする", ASSIGN, 1)
    for uid in MEMBERS:
        b.sb(env, "POST", "enrollments", {"user_id": uid, "course_id": c["id"], "status": "active"})
    print(f"受講登録: {len(MEMBERS)}名\n受講URL: /courses/{c['id']}\n完成 🎓")


if __name__ == "__main__":
    main()
