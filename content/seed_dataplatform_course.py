#!/usr/bin/env python3
"""AIデータ基盤「Everything is an event」コースを一括作成。Tier1⑤（やや上級者向け）。
元ネタ=北爪さんの長文解説(Sierra題材)を一般化。イベント設計→ClickHouse集約→4役で活用→課金KPI。"""
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


L1 = """AIエージェント／SaaSを運用すると、「障害は起きてないか」「どの機能が使われているか」「顧客にどう価値が出たか」「いくら課金するか」――と**知りたいことが山ほど**出てきます。これらを**別々に作ると破綻**します。

## 考え方：Everything is an event（すべてをイベントにする）
- アプリやAIエージェントの**あらゆる行動を“イベント”として1本のストリームに記録**する。
  - 例：メッセージ受信 / ツール呼び出し / モデル応答 / エラー / 解決 / 課金対象アクション…
- そのイベント基盤を**1つの土台**にして、用途ごとに集計・加工して使う。

## なぜ1本化するのか
- 監視・分析・顧客向けダッシュボード・課金が**同じ事実（イベント）**を見るので、数字がズレない。
- 新しい問い（KPI）が来ても、**基盤はそのまま、集計を足すだけ**で答えられる。

> 合言葉：「**まずイベントで残す。意味づけ（集計）は後から何通りでも**」。
"""

L2 = """**イベント設計**が基盤の良し悪しを決めます。「後から何にでも使える形」で残すのがコツです。

## 1イベントに持たせる基本項目
| 項目 | 意味 |
|---|---|
| event_time | いつ起きたか（UTCで保存） |
| event_type | 何が起きたか（`message.received` / `tool.called` / `error` …） |
| actor / session_id | 誰の・どのセッションか |
| tenant_id | どの顧客（マルチテナント） |
| properties (JSON) | 種類ごとの詳細（モデル名・トークン数・レイテンシ・結果…） |

## 設計のコツ
- **命名を揃える**：`名詞.動詞`（`tool.called`）のように一貫させる。後の集計が楽。
- **広く薄く**：まず広く記録。使うかどうかは後で決める（捨てるのは簡単、無い過去は作れない）。
- **PII（個人情報）に注意**：本文をそのまま入れない／マスキング／保持期間を決める。
- **immutable（追記のみ）**：イベントは書き換えない。訂正も「訂正イベント」を足す。

> 「1行＝1つの出来事」。粒度を細かく、意味は properties に寄せる。
"""

L3 = """イベントの**置き場所**を選びます。鍵は **ClickHouse（分析用）と Postgres（業務用）の使い分け**です。

## 役割の違い
| | Postgres（OLTP） | ClickHouse（OLAP・列指向） |
|---|---|---|
| 得意 | 1件の読み書き・トランザクション・業務データの正 | **大量イベントの集計・集約を高速に** |
| 使う場面 | 注文・ユーザー・課金の“正データ” | ログ/イベントの分析・ダッシュボード |
| 苦手 | 億単位の集計は重い | 1件更新・強い整合 |

## 基本方針
- **業務の正データ**（誰が・いくら・契約）は **Postgres**。
- **イベントの奔流**（全行動ログ）は **ClickHouse** に流して集計。
- 2つを**無理に1つにしない**。それぞれ得意なことをさせる。

## 流し込み
- アプリ → （キュー/バッファ）→ ClickHouse へバルク投入（1件ずつでなくまとめて）。
- 失敗時の再送・重複排除（event_id で冪等）を用意。

> 「正しさは Postgres、量と速さは ClickHouse」。これが土台の分担。
"""

L4 = """生イベントは量が多すぎて、毎回スキャンすると重い。**Materialized View（MV）で“あらかじめ集計”**しておきます。

## Materialized View とは
- 元テーブルにデータが入るたび、**自動で集計結果を更新**してくれる仕組み（ClickHouse 等）。
- ダッシュボードは、生イベントではなく**集計済みの小さな表**を見る → 速い。

## 例：分単位の集計
- 生：`events`（1行＝1アクション、億行）
- MV：`events_per_min`（テナント×分×event_type ごとの件数・平均レイテンシ・エラー数）
- ダッシュボードや監視は `events_per_min` を読む。

## 設計のコツ
- **よく見る粒度**（分/時/日 × テナント × 種類）であらかじめ集約。
- 生データは**保持期間**を決めて落とす（コスト対策）。集計は長く残す。
- 後から粒度を足したくなるので、**生イベントは一定期間は残す**。

> 「重い集計は“その場でやらない”。MVで作り置きして、読むだけにする」。
"""

L5 = """1つのイベント基盤を、**4つの用途**で使い回します。ここが「1本化」の旨味です。

## 同じ基盤で4役
1. **障害監視（Observability）**：エラー率・レイテンシ・詰まりをリアルタイムに検知。アラート。
2. **プロダクト分析**：どの機能が使われ、どこで離脱するか。改善の判断材料。
3. **顧客向けAnalytics**：顧客のダッシュボードに「あなたの利用状況・成果」を見せる（テナント単位で切る）。
4. **課金KPI**：課金対象アクションの集計 → 請求・使用量ベースの料金。

## 効く理由
- 4つが**同じ事実**を見るので、「監視の数字」と「請求の数字」が食い違わない。
- 新しい問いも、**基盤はそのまま／MVや集計を足すだけ**で答えられる。
- テナント単位（tenant_id）で切れるので、社内用も顧客用も同じ仕組みで出せる。

> 監視・分析・顧客向け・課金は、**別システムではなく同じイベント基盤の“ビュー”**。
"""

L6 = """AI時代の料金は、**成果・使用量ベース（outcome / usage-based pricing）**に向かいます。基盤の最後のピースが**指標設計**です。

## なぜ成果/使用量ベースか
- AIエージェントは「席数」より「**どれだけ仕事をしたか**」が価値。
- 例：解決した問い合わせ数・処理した件数・自動化できた工数。

## 指標の作り方（イベントから）
1. **課金対象アクション**を event_type で定義（例：`resolution.completed`）。
2. テナント×期間で集計（MV）。
3. 「**成果の定義**」を顧客と合意する（何を1件と数えるか／失敗は数えないか）。
4. 透明性：顧客ダッシュボードで**同じ数字**が見える（請求と一致）。

## 落とし穴
- 成果の定義が曖昧だと、請求で揉める。**定義と計測を最初に決める**。
- 計測は必ず**イベント基盤の1つの数字**を正にする（画面ごとに別計算にしない）。

## まとめ
イベントで残す → 正はPostgres・量はClickHouse → MVで作り置き → 1基盤で監視/分析/顧客/課金 → 成果指標で課金。
これがAIプロダクトの**データ基盤の背骨**です。

> 「課金KPIは、監視・分析と同じイベントから作る」。別計算にしないことが、信頼される料金の条件。
"""


def main():
    c = b.sb(env, "POST", "courses", {
        "title": "AIプロダクトのデータ基盤 ― Everything is an event",
        "description": (
            "AIエージェント／SaaSの運用に効く『イベント基盤』の設計を学ぶ、やや上級者向けコース。"
            "すべての行動をイベントで残し、業務の正データ（Postgres）と分析（ClickHouse）を使い分け、"
            "Materialized Viewで集計を作り置きし、1つの基盤で「障害監視・プロダクト分析・顧客向けAnalytics・課金KPI」を賄う。"
            "最後に成果/使用量ベース課金の指標設計まで。全6回＋クイズ＋設計課題。"),
        "status": "published", "is_sequential": False, "created_by": ADMIN_UUID})[0]
    sid = b.sb(env, "POST", "sections", {"course_id": c["id"], "title": "本編", "sort_order": 0})[0]["id"]
    print(f"講座作成: {c['id']}\nsection: {sid}")

    lesson(sid, "第1回 なぜイベント基盤か ― Everything is an event", L1, 0)
    lesson(sid, "第2回 イベントの設計 ― 後から何にでも使える形で残す", L2, 1)
    lesson(sid, "第3回 置き場所 ― ClickHouse と Postgres の使い分け", L3, 2)
    quiz(sid, "理解度チェック① 思想・設計・置き場所", "第1〜3回の確認。", 3, [
        {"type": "single_choice", "q": "「Everything is an event」の基本方針は？",
         "opts": s(1, "用途ごとに別DBを最初から作る", "あらゆる行動をイベントで1本に残し、集計は後から何通りでも作る", "ログは残さない", "画面ごとに別集計する"),
         "exp": "まず残す。意味づけ（集計）は後から。"},
        {"type": "single_choice", "q": "イベント設計のコツとして正しいのは？",
         "opts": s(0, "命名を揃え、広く薄く残し、追記のみ（書き換えない）", "本文をそのまま全部保存", "使う分だけ狭く残す", "随時書き換える"),
         "exp": "名詞.動詞で命名、immutable、PIIに注意。無い過去は作れない。"},
        {"type": "single_choice", "q": "ClickHouse と Postgres の使い分けは？",
         "opts": s(2, "両方で業務トランザクション", "両方で億件集計", "正データはPostgres、イベントの集計はClickHouse", "どちらでも同じ"),
         "exp": "正しさはPostgres、量と速さ（列指向集計）はClickHouse。"},
        {"type": "single_choice", "q": "イベントの重複を防ぐ基本は？",
         "opts": s(3, "祈る", "手で消す", "1件ずつ投入", "event_id で冪等にし、再送しても重複しないようにする"),
         "exp": "まとめて投入＋event_idで重複排除。"},
        tf("イベントは1行=1つの出来事とし、詳細は properties(JSON) に寄せるとよい。", True, "○。粒度は細かく、意味はpropertiesへ。"),
    ])

    lesson(sid, "第4回 Materialized View で集計を作り置きする", L4, 4)
    lesson(sid, "第5回 1つの基盤で4役（監視・分析・顧客向け・課金）", L5, 5)
    lesson(sid, "第6回 成果/使用量ベース課金と指標設計", L6, 6)
    quiz(sid, "理解度チェック② 集計・活用・課金", "第4〜6回の確認。", 7, [
        {"type": "single_choice", "q": "Materialized View を使う理由は？",
         "opts": s(0, "重い集計をあらかじめ作り置きし、ダッシュボードは小さな集計表を読むだけにする", "データを消すため", "見た目を良くするため", "バックアップのため"),
         "exp": "その場で集計せず、作り置きを読む＝速い。"},
        {"type": "single_choice", "q": "1つのイベント基盤で賄える4役は？",
         "opts": s(1, "開発・営業・人事・経理", "障害監視・プロダクト分析・顧客向けAnalytics・課金KPI", "設計・実装・テスト・運用", "入力・処理・出力・保存"),
         "exp": "同じ事実を見るので数字がズレない。"},
        {"type": "single_choice", "q": "課金KPI（成果/使用量）を作るときの鉄則は？",
         "opts": s(2, "画面ごとに別計算", "勘で決める", "監視・分析と同じイベントから計算し、顧客と同じ数字を見せる", "毎月手集計"),
         "exp": "別計算にしない。定義と計測を最初に合意。"},
        {"type": "single_choice", "q": "生イベントとコストの扱いで適切なのは？",
         "opts": s(3, "永遠に全部生で保持", "すぐ全部消す", "集計だけ消す", "生は保持期間を決めて落とし、集計は長く残す"),
         "exp": "後で粒度を足せるよう生も一定期間は残す。"},
        tf("顧客向けダッシュボードは tenant_id で切れば、同じ基盤から顧客ごとに出せる。", True, "○。社内用も顧客用も同じ仕組み。"),
    ])

    assignment(sid, "設計課題：自分（または担当プロダクト）のイベント基盤を設計する",
               "AIエージェント/SaaS（想定でも可）を1つ選び、イベント基盤を設計してください。\n\n"
               "【書くこと】\n"
               "1. 記録するイベント種類を5つ以上（event_type の命名を揃える）\n"
               "2. 1イベントの項目（time/type/tenant/properties など）\n"
               "3. 置き場所：Postgres に置く“正データ”と、ClickHouse に流す“イベント”の切り分け\n"
               "4. Materialized View：どの粒度（分/時/日×テナント×種類）で集計を作り置きするか\n"
               "5. 4役のうち2つ以上（監視/分析/顧客向け/課金）で、どんな問いに答えるか\n"
               "6. 課金KPI：課金対象アクションと「1件の定義」\n\n"
               "※顧客名・機密は一般化して書いてください。", 8)

    for uid in MEMBERS:
        b.sb(env, "POST", "enrollments", {"user_id": uid, "course_id": c["id"], "status": "active"})
    print(f"受講登録: {len(MEMBERS)}名\n受講URL: /courses/{c['id']}\n完成 🎓")


if __name__ == "__main__":
    main()
