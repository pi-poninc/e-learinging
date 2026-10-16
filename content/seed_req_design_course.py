#!/usr/bin/env python3
"""要求と設計の型（分類に落とす×Figmaで全体絵×過剰設計を防ぐ）コースを一括作成。
Tier2。元ネタ #7/#4/#22 を一般化。顧客ワークショップ講座の実践編。"""
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


L1 = """バラバラの「あれもこれも」という**要求**を、設計に使える形に落とすのがこの講座です。鍵は **“分類（レーン）に落とす”** こと。顧客ワークショップ講座の実践編にあたります。

## なぜ分類するのか
- 要求は、集めただけでは**重複・粒度バラバラ・抜け**がある。
- **分類（レーン）**に並べ替えると、全体像・抜け・優先度が見える。

## 分類の作り方
- 業務の**まとまり**でレーンを作る（例：受付／登録／照会／管理…）。
- 各要求をレーンに配る。どこにも入らないものは**「その他」レーン**へ一旦避難。
- レーンごとに「**過不足ないか**」を点検する。

## 「その他」レーンの使い方（重要）
- 「その他」は**捨て場ではなく“保留置き場”**。たまってきたら、新しいレーンの芽か、不要かを判断する。
- 「その他」が膨らむのは、**分類軸が合っていない**サイン。

> 要求は「並べる」のではなく「**分類に落とす**」。全体像・抜け・優先度が初めて見える。
"""

L2 = """分類できたら、**Figma等で“全体絵”をモジュール化**して可視化します。言葉の一覧より、絵の方が過不足が分かります。

## 全体絵（モジュール図）とは
- 画面やモジュールを**箱**で並べ、関係を線でつなぐ、プロダクト全体の地図。
- レーン（分類）と**対応**させると、「この分類にはこの画面」と結びつく。

## なぜFigmaのようなUIツールか
- **顧客と一緒に見られる**（言葉だけだと解釈がずれる）。
- 箱の**粒度**をそろえると、過不足（抜け・重複）が見つかる。
- 「ここは1画面？2画面？」といった**具体の議論**に入れる。

## 作り方のコツ
- まず**粗く全体**（細部より網羅）。細部は後で各モジュールに展開。
- 変更は全体絵に反映し、**常に最新の地図**を保つ。
- 全体絵は「仕様の代わり」ではなく「**共通認識のための地図**」。

> 分類（言葉）と全体絵（図）の両輪。**絵にすると過不足が見える**。
"""

L3 = """**過剰設計（オーバーエンジニアリング）を防ぐ**。要求と全体絵ができても、作りすぎると破綻します。

## よくある過剰
- **要らない技術を足す**：RESTで足りるのに複雑な仕組みを入れる等。
- **将来のため**に、今使わない柔軟性を先に作り込む。
- 項目・ステータス・設定を**網羅しすぎる**。

## 最小で作る判断
- 「**この要求は今回のスコープか？**」を常に問う（やりたいこと全部≠今回）。
- 技術選定は「**いちばん単純で要件を満たすもの**」を選ぶ。
- 迷ったら**後から足せる**方を選ぶ（減らす方が難しい）。

## インフラ・技術選定でも同じ
- アカウント分離・権限は**事故を防ぐ最小限**に。
- 「流行っているから」ではなく「**この要件に必要か**」で選ぶ。

> 設計の敵は“あったら便利”。**今回のスコープと、最も単純な解**に立ち返る。
"""

L4 = """最後に、**要求 → 設計への橋渡し**。決まったこと・決まっていないことを分けて、走れる形にします。

## 橋渡しの成果物
- **スコープ**：今回やる／やらない の線引き。
- **WBS/タスク**：分類と全体絵から、作業に分解。
- **未決事項（オープンクエスチョン）**：決まっていない前提を一覧化（受託PM講座と接続）。

## AIの活用（任意）
- 似た事例や参考をもとに、**要件の素案とWBSをAIで起こし**、人が確認・修正する。
- 「次の打ち合わせで**決めること**」をAIに洗い出させ、会議の頭出しにする。

## まとめ
分類に落とす → 全体絵で可視化 → 過剰設計を避ける → スコープ/WBS/未決に橋渡し。
これが「要求を設計に変える」型です。

> 要求は分類で見える化、全体絵で共有、最小で設計、未決を添えて走る。顧客WSの実践編。
"""


def main():
    c = b.sb(env, "POST", "courses", {
        "title": "要求と設計の型 ― 分類に落とす・全体絵で可視化・過剰設計を防ぐ",
        "description": (
            "バラバラの要求を設計に使える形へ変える実践講座（顧客ワークショップ講座の実践編）。"
            "要求を分類（レーン）に落として全体像と抜けを見える化 → Figma等で全体絵をモジュール化して顧客と共有 → "
            "過剰設計を避けて最小で作る → スコープ/WBS/未決事項へ橋渡し。実案件を一般化。全4回＋クイズ＋実践課題。"),
        "status": "published", "is_sequential": False, "created_by": ADMIN_UUID})[0]
    sid = b.sb(env, "POST", "sections", {"course_id": c["id"], "title": "本編", "sort_order": 0})[0]["id"]
    print(f"講座作成: {c['id']}\nsection: {sid}")

    lesson(sid, "第1回 要求を“分類（レーン）”に落とす", L1, 0)
    lesson(sid, "第2回 Figmaで全体絵をモジュール化する", L2, 1)
    lesson(sid, "第3回 過剰設計を防ぐ（スコープと技術選定）", L3, 2)
    lesson(sid, "第4回 要求→設計への橋渡し（スコープ/WBS/未決）", L4, 3)
    quiz(sid, "理解度チェック 要求と設計の型", "第1〜4回の確認。", 4, [
        {"type": "single_choice", "q": "集めた要求を最初にどうする？",
         "opts": s(0, "分類（レーン）に落として全体像・抜け・優先度を見える化する", "思いついた順に実装", "全部すぐ作る", "捨てる"),
         "exp": "並べるだけでは重複・粒度バラバラ。分類が先。"},
        {"type": "single_choice", "q": "「その他」レーンの正しい扱いは？",
         "opts": s(1, "捨て場にする", "保留置き場とし、溜まったら新レーンの芽か不要かを判断する", "放置", "最優先にする"),
         "exp": "その他が膨らむのは分類軸が合っていないサイン。"},
        {"type": "single_choice", "q": "Figma等で全体絵を作る目的は？",
         "opts": s(2, "見た目を綺麗にする", "デザインを納品する", "顧客と共通認識を持ち、粒度を揃えて過不足を見つける", "実装を省く"),
         "exp": "全体絵は仕様ではなく共通認識の地図。"},
        {"type": "single_choice", "q": "過剰設計を防ぐ判断は？",
         "opts": s(3, "流行りの技術を入れる", "将来のため柔軟性を今作り込む", "項目を網羅する", "今回のスコープか／最も単純で要件を満たすかで選ぶ"),
         "exp": "“あったら便利”は敵。迷ったら後から足せる方。"},
        tf("要求→設計の橋渡しでは、未決事項（オープンクエスチョン）を一覧化して走るとよい。", True, "○。受託PMの未確定可視化と接続する。"),
    ])

    assignment(sid, "実践課題：要求を分類に落として全体絵にする",
               "実在または想定のテーマで、要求を設計の入口まで落としてください。\n\n"
               "【書くこと】\n"
               "1. 要求を10個以上集め、3〜6のレーン（分類）に配る（「その他」も）\n"
               "2. 各レーンの過不足チェック（抜け・重複）\n"
               "3. 全体絵：主要モジュール（箱）を粗く描く／関係を書く（図や箇条書きで可）\n"
               "4. 過剰設計チェック：今回のスコープ外に避けたものを2つ\n"
               "5. 未決事項：決まっていない前提を3つ\n\n"
               "※顧客名・固有名は一般化して書いてください。", 5)

    for uid in MEMBERS:
        b.sb(env, "POST", "enrollments", {"user_id": uid, "course_id": c["id"], "status": "active"})
    print(f"受講登録: {len(MEMBERS)}名\n受講URL: /courses/{c['id']}\n完成 🎓")


if __name__ == "__main__":
    main()
