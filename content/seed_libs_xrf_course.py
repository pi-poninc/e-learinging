#!/usr/bin/env python3
"""製造業シリーズ続編：成分分析入門（LIBS/XRFと品種判別）コースを一括作成。
Tier2。元ネタ #8（超硬チップのTA選別、W/Co/Ti/Ta/Nb、コーティング、XRF比較、画像だけでは判別不可）を一般化。
「工場の電気設備 入門」「超硬チップAI選別」の姉妹編。"""
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


L1 = """製造現場では、見た目がそっくりでも**成分が違う**部材がよくあります。これを見分けるのが**成分分析**。この講座は「工場の電気設備 入門」「超硬チップAI選別」の姉妹編、前提知識シリーズです。

## なぜ画像AIだけでは品種判別できないのか
- 超硬チップのような部材は、**外見（形・色）が似ていても中身の成分が違う**。
- 表面に**コーティング**がかかっていると、見た目からは下地の成分が分からない。
- だから「写真を撮って分類」だけでは限界があり、**刻印を読む**か**成分を測る**必要がある。

## 成分で何を見るか（例）
- 超硬の代表的な元素：**W（タングステン）・Co（コバルト）・Ti・Ta・Nb** など。
- これらの**比率**で品種・グレードが変わる。

## この講座の流れ
1. なぜ成分分析が要るか（画像の限界）
2. XRF（蛍光X線）入門
3. LIBS入門とXRFとの比較
4. 現場での品種判別（刻印・成分・コーティング）

> 「見た目では分からない」。だから**刻印か成分**。これが成分分析の出発点です。
"""

L2 = """**XRF（蛍光X線分析）**の入門です。非破壊で元素を調べられる、現場で広く使われる手法です。

## 原理（ざっくり）
- 試料に**X線を当てる**と、含まれる元素が、その元素ごとに決まった**蛍光X線**を返す。
- 返ってきたX線の**エネルギー**で「どの元素か」、**強さ**で「どれくらい含むか」が分かる。

## 長所
- **非破壊**（壊さず測れる）。
- ハンディ機もあり、**現場でその場で**測れる。
- 金属の元素組成の把握に強い。

## 注意・限界
- **軽い元素（炭素など）は苦手**（検出しにくい）。
- 表面の状態（**コーティング・汚れ**）の影響を受けることがある。
- あくまで**元素**の分析（結晶構造などは別の手法）。

> XRFは「X線を当てて、返る蛍光X線で元素と量を読む」。非破壊・現場向きだが、軽元素とコーティングに注意。
"""

L3 = """**LIBS（レーザー誘起ブレイクダウン分光）**の入門と、**XRFとの使い分け**です。

## LIBSの原理（ざっくり）
- 試料に**強いレーザー**を当てて、ごく微小な部分を**プラズマ化**（蒸発・発光）させる。
- その**発光の波長（色）**を分光して、含まれる元素を読む。

## XRF と LIBS の比較
| | XRF | LIBS |
|---|---|---|
| 当てるもの | X線 | レーザー |
| 読むもの | 蛍光X線 | 発光スペクトル |
| 軽元素 | 苦手 | **比較的得意** |
| 破壊性 | 非破壊 | ごく微小に消耗（ほぼ非破壊） |
| 現場 | ハンディ機あり | ハンディ機あり |

## 使い分けの考え方
- **元素の種類・軽元素**まで見たい → LIBS が有利な場面。
- 金属組成を**手軽に非破壊**で → XRF が手堅い。
- 実務では**両方の特性を理解して選ぶ**（片方が万能ではない）。

> LIBSはレーザーで光らせて色で読む。**軽元素に強い**。XRFと特性を理解して使い分ける。
"""

L4 = """最後に、**現場での品種判別**をどう組み立てるか。測定手法と情報を**組み合わせて**精度と速さを両立します。

## 判別の材料を組み合わせる
- **刻印・マーキング**：メーカーや品番が読めれば、それが最も確実な手がかり。
- **成分（XRF/LIBS）**：刻印がない・摩耗で読めないときの決め手。
- **形状・寸法**：補助情報（これだけでは不足）。
- **コーティングの有無**：下地を測るには表面処理を考慮。

## 現実的なフロー（例）
1. まず**刻印**を読む（画像/OCR/人）。読めればそれで判定。
2. 読めない個体だけ**成分分析**に回す（XRF/必要ならLIBS）。
3. **確信度が低いものは人へ**（例外処理。現場起点講座と同じ発想）。

## AI化のポイント
- 「画像だけで分類」に頼らず、**刻印読み取り＋成分**を組み合わせる設計にする。
- 混ざると困る品種（誤判定のコストが高い）を**重点的に**検証する（ハルシネーション対策講座と接続）。

## まとめ
画像の限界 → XRF（蛍光X線・非破壊）→ LIBS（レーザー・軽元素に強い）→ 刻印＋成分を組み合わせて判別。

> 品種判別は「1つの手法」ではなく「**刻印＋成分＋運用**」の組み合わせ。見た目頼みにしない。
"""


def main():
    c = b.sb(env, "POST", "courses", {
        "title": "成分分析入門 ― LIBS/XRFと品種判別（製造業シリーズ）",
        "description": (
            "「工場の電気設備 入門」「超硬チップAI選別」の姉妹編となる、製造業の前提知識シリーズ。"
            "見た目では分からない部材を見分ける成分分析を学ぶ。画像AIだけでは品種判別できない理由 → "
            "XRF（蛍光X線・非破壊）の原理と限界 → LIBS（レーザー・軽元素に強い）とXRFの使い分け → "
            "刻印＋成分＋運用を組み合わせた現場の品種判別。全4回＋クイズ＋課題。"),
        "status": "published", "is_sequential": False, "created_by": ADMIN_UUID})[0]
    sid = b.sb(env, "POST", "sections", {"course_id": c["id"], "title": "本編", "sort_order": 0})[0]["id"]
    print(f"講座作成: {c['id']}\nsection: {sid}")

    lesson(sid, "第1回 なぜ成分分析が要るか（画像AIの限界）", L1, 0)
    lesson(sid, "第2回 XRF（蛍光X線分析）入門", L2, 1)
    lesson(sid, "第3回 LIBS入門とXRFとの使い分け", L3, 2)
    lesson(sid, "第4回 現場での品種判別（刻印＋成分＋運用）", L4, 3)
    quiz(sid, "理解度チェック 成分分析入門", "第1〜4回の確認。", 4, [
        {"type": "single_choice", "q": "画像AIだけで超硬チップの品種判別が難しい主な理由は？",
         "opts": s(0, "外見が似ていても成分が違い、コーティングで下地が見えないため", "カメラが高いから", "AIが遅いから", "照明が暗いから"),
         "exp": "見た目では中身が分からない。刻印か成分が必要。"},
        {"type": "single_choice", "q": "XRF（蛍光X線）の説明として正しいのは？",
         "opts": s(1, "レーザーで燃やして色を読む", "X線を当て、返る蛍光X線のエネルギーと強さで元素と量を読む（非破壊）", "重さで判定する", "磁石で分ける"),
         "exp": "非破壊・現場向き。ただし軽元素が苦手。"},
        {"type": "single_choice", "q": "LIBS が XRF より有利になりやすいのは？",
         "opts": s(2, "完全な非破壊が必須のとき", "金属だけを手軽に測るとき", "炭素などの軽元素まで見たいとき", "電源が無いとき"),
         "exp": "LIBSは軽元素に比較的強い。XRFは軽元素が苦手。"},
        {"type": "single_choice", "q": "現場の品種判別の組み立て方で適切なのは？",
         "opts": s(3, "画像分類だけに頼る", "常に全数をLIBS", "寸法だけで決める", "まず刻印を読み、読めない個体だけ成分分析、確信度が低いものは人へ"),
         "exp": "刻印＋成分＋運用（例外は人）の組み合わせ。"},
        tf("XRFはコーティングや表面の汚れの影響を受けることがある。", True, "○。下地を測るには表面処理を考慮する。"),
    ])

    assignment(sid, "課題：ある部材の品種判別フローを設計する",
               "見分けたい部材（超硬チップ等、想定可）を1つ選び、判別フローを設計してください。\n\n"
               "【書くこと】\n"
               "1. 見た目が似ていて誤りやすい品種の例\n"
               "2. 使う手がかり：刻印/成分(XRF or LIBS)/形状/コーティングの扱い\n"
               "3. XRFとLIBSのどちらを・どの場面で使うか（理由）\n"
               "4. 現実的なフロー：まず何で判定し、どこで成分分析に回し、どこで人に回すか\n"
               "5. 誤判定のコストが高い品種と、その重点検証\n\n"
               "※顧客名・機密の数値は一般化して書いてください。", 5)

    for uid in MEMBERS:
        b.sb(env, "POST", "enrollments", {"user_id": uid, "course_id": c["id"], "status": "active"})
    print(f"受講登録: {len(MEMBERS)}名\n受講URL: /courses/{c['id']}\n完成 🎓")


if __name__ == "__main__":
    main()
