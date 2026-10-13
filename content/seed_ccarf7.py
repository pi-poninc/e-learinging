#!/usr/bin/env python3
"""CCAR-F 仕上げ: (1) 9章サンプル問題12問を模擬問題集コースに追加
                 (2) 実装4コースを束ねる学習ロードマップ（path）を作成。

出典: 試験ガイド9章（状況・正解の考え方・外れ理由から、選択式に再構成）。
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ADMIN_UUID = "bab3dae7-813b-43ee-b7f9-200ca779dcfd"
MEMBERS = [ADMIN_UUID, "8936dff0-704d-4d2f-bff0-c84869eec0fc", "fd11370b-58d9-4d8c-b95b-bdd851515f34"]

# 既存の模擬問題集コースの「模擬試験」セクション（第1弾/第2弾/解説動画が入っている）
COURSE1_SECTION = "d3ed0e70-eaab-4398-afd0-24274d694e00"

# 実装4コース（course_id）
C_AGENT   = "d8324fcc-f10e-459c-b3d4-88ea4f7cec9a"  # 実装① 課題1 サポートエージェント
C_RESEARCH = "c7703362-55cc-4e40-8fec-f4db314c78fb"  # 実装② 課題4 マルチエージェント調査
C_EXTRACT = "847acefe-d162-4de7-b915-d652e8271d66"  # 実装③ 課題3 構造化データ抽出
C_CONFIG  = "8f36172d-5c5c-4a0c-8c54-66cb25fdbb1f"  # 実装④ 課題2 Claude Code 設定

sys.path.insert(0, str(ROOT / "content"))
import build as b  # noqa: E402

env = b.load_env()


def s(correct, *opts):
    return [(t, i == correct) for i, t in enumerate(opts)]


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
    print(f"  quiz {title}  {q['id']}  ({len(questions)}問)")
    return q["id"]


# ===== 9章 サンプル問題 12問（状況＋正解の考え方＋外れ理由から再構成）=====
S1 = "[サポート対応エージェント] "
S2 = "[Claude Code でのコード生成] "
S3 = "[マルチエージェント調査] "
S5 = "[CI でのコードレビュー] "

QUIZ9 = [
    {"type": "single_choice", "q": S1 + "12%のケースで本人確認（get_customer）を飛ばして注文照会に進み、誤った返金が起きている。最も適切な対策は？",
     "opts": s(0,
        "確認済みの顧客IDが返るまで、後続のツール（注文照会・返金）をコード（フック）でブロックする",
        "システムプロンプトを強化し、few-shot の例を足して順序の順守を促す",
        "ツールの説明文を書き分けて、正しい順序を選ばせる",
        "本人確認を飛ばした返金を、あとから自動で取り消す"),
     "exp": "正解A。金銭が絡む順序は確定的にコードで強制する。プロンプト強化や few-shot は確率的な順守にとどまる。ツールの出し分けは順序の問題を解かない。"},
    {"type": "single_choice", "q": S1 + "注文の問い合わせなのに get_customer が呼ばれる。両ツールの説明が最小限。最初に取るべき一手は？",
     "opts": s(0,
        "各ツールの説明に、入力形式・例・例外・使い分けの境界を書き足す",
        "few-shot の例を足す",
        "入力からキーワードを検出してツールを選ぶ振り分け層を作る",
        "2つのツールを1つに統合する"),
     "exp": "正解A。説明文がツール選択の主な手がかり。few-shot は根本原因を直さない。振り分け層は過剰。統合は最初の一手としては重い。"},
    {"type": "single_choice", "q": S1 + "初回解決率が55%。簡単な案件を引き継ぎ、例外対応が必要な案件を自力で処理している。最適な対策は？",
     "opts": s(0,
        "引き継ぎ基準をシステムプロンプトに明示し、few-shot の例で示す",
        "各案件に自己申告の確信度を付けさせ、低いものを引き継ぐ",
        "案件の難易度を判定する分類モデルを別に足す",
        "感情分析で不満度を測り、高ければ引き継ぐ"),
     "exp": "正解A。原因は引き継ぎの判断境界が不明確なこと。自己申告の確信度は当てにならない。分類モデルは過剰。感情は案件の難しさと相関しない。"},
    {"type": "single_choice", "q": S2 + "チーム共通の /review コマンドを、リポジトリを取得した全員が使えるようにしたい。どこに置く？",
     "opts": s(0,
        "リポジトリ内の .claude/commands/ に置く（バージョン管理で共有される）",
        "~/.claude/commands/ に置く",
        "プロジェクトの CLAUDE.md にコマンドを書く",
        "config.json にコマンドを登録する"),
     "exp": "正解A。.claude/commands/ はリポジトリで共有される。ホーム側は個人用。CLAUDE.md はコマンド定義の場所ではない。config.json の仕組みは存在しない。"},
    {"type": "single_choice", "q": S2 + "モノリスをマイクロサービスに再構成する。数十ファイルに及び、境界の判断が必要。進め方は？",
     "opts": s(0,
        "plan mode で調査と設計をしてから変更する",
        "直接実行で始め、問題が出たら直す",
        "全ファイルを1回のプロンプトで変更させる",
        "まずインタビュー方式で設計質問だけ先に片付ける"),
     "exp": "正解A。直接実行から始めると依存関係の発見が遅れて手戻りになる。複雑さは最初から分かっているので、調査と設計を先に行う。"},
    {"type": "single_choice", "q": S2 + "領域ごとに規約が違い、テストファイルはコードベース全体に散らばっている。規約をどう効かせる？",
     "opts": s(0,
        ".claude/rules/ に glob パターン付きのルールを置き、パスに応じて自動適用する",
        "ルートの CLAUDE.md に全規約をまとめる",
        "規約をスキルにして、必要なときに手動で呼ぶ",
        "ディレクトリごとに CLAUDE.md を置いて回る"),
     "exp": "正解A。ルートにまとめると適用が推測頼み。スキルは自動適用にならない。ディレクトリ別の CLAUDE.md は散らばったファイルに対応しにくい。"},
    {"type": "single_choice", "q": S3 + "「AIがクリエイティブ産業に与える影響」の調査が視覚芸術だけになった。コーディネーターの分解が3つとも視覚芸術だった。最も可能性の高い原因は？",
     "opts": s(0,
        "コーディネーターのタスク分解が狭すぎること",
        "下流の検索サブエージェントの性能が低いこと",
        "統合エージェントが範囲を絞りすぎていること",
        "検索ツールがタイムアウトしていること"),
     "exp": "正解A。下流の各エージェントは割り当てられた範囲で正しく動いている。原因はコーディネーターの分解が狭いこと。"},
    {"type": "single_choice", "q": S3 + "Web検索サブエージェントがタイムアウトした。失敗をどう伝えるのが最適？",
     "opts": s(0,
        "失敗の種類・試した問い合わせ・途中結果・代替案を構造化して返す",
        "一般的なステータス（failed）だけを返す",
        "空の結果を成功として返す",
        "ワークフロー全体を停止する"),
     "exp": "正解A。一般的なステータスは文脈を隠す。空の結果を成功として返すのは握りつぶし。全体停止は不要。"},
    {"type": "single_choice", "q": S3 + "統合エージェントの事実確認が毎回コーディネーター経由で、遅延が40%増えている。確認の85%は単純。最適な対策は？",
     "opts": s(0,
        "統合エージェントに範囲を絞った verify_fact ツールを持たせ、複雑な確認だけ従来の経路に残す",
        "確認をまとめて最後に後回しにする",
        "統合エージェントに検索ツールを全部渡す",
        "事実を先回りでキャッシュしておく"),
     "exp": "正解A。まとめて後回しにすると依存関係で詰まる。検索ツールを全部渡すのは権限の与えすぎ。先回りのキャッシュは当たらない。"},
    {"type": "single_choice", "q": S5 + "パイプラインで Claude Code が対話入力を待って止まる。どう直す？",
     "opts": s(0,
        "-p フラグで非対話モードにする",
        "環境変数で非対話モードに切り替える",
        "--batch フラグを付ける",
        "標準入力をリダイレクトする"),
     "exp": "正解A。-p（非対話）が要る。環境変数や --batch フラグは存在しない。標準入力のリダイレクトは正しい方法ではない。"},
    {"type": "single_choice", "q": S5 + "マージ前チェックと夜間の技術的負債レポートを、両方 Message Batches API に移す提案が出た。どう評価する？",
     "opts": s(0,
        "夜間レポートだけバッチにし、マージ前チェックはリアルタイムのまま残す",
        "両方ともバッチに移す",
        "両方ともリアルタイムのまま残す",
        "マージ前チェックだけをバッチにする"),
     "exp": "正解A。バッチは最大24時間で遅延保証がなく、人を待たせるマージ前チェックには使えない。結果は custom_id で突き合わせられる。"},
    {"type": "single_choice", "q": S5 + "14ファイルの PR を1回でレビューすると、深さがばらつき、矛盾した指摘が出る。最適な設計は？",
     "opts": s(0,
        "ファイルごとのパスと、ファイル横断の統合パスに分ける",
        "開発者に PR を小さく分割してもらう",
        "より大きなコンテキストのモデルに変える",
        "レビューを複数回実行して多数決を取る"),
     "exp": "正解A。PR の分割要求は開発者に負担を移すだけ。大きなコンテキストは注意の質を解決しない。多数決は本物のバグを落とす。"},
]


def main():
    assert len(QUIZ9) == 12
    print("=== (1) 9章サンプル問題12問を模擬問題集コースに追加 ===")
    quiz(COURSE1_SECTION, "第3弾 9章サンプル問題 12問（本番準拠）",
         "試験ガイド9章のサンプル問題を、本番の傾向に沿って再構成した12問。全問解説付き。", 4,
         QUIZ9, passing=80, minutes=24)

    print("=== (2) 実装4コースを束ねる学習ロードマップ ===")
    path = b.sb(env, "POST", "learning_paths", {
        "title": "CCAR-F 実装マスター（課題1〜4）",
        "description": "試験ガイド8章の4つの練習課題を、実装コードで理解していくロードマップ。"
                       "エージェントの基礎 → 複数エージェント → 構造化抽出 → Claude Code 設定 の順に、"
                       "週1本ペースで進めます。実務の判断（分野1〜5）が手を動かして身につきます。",
        "status": "published", "sort_order": 1})[0]
    pid = path["id"]
    print(f"  path: {pid}")

    items = [
        (C_AGENT,    0,  7, "エージェントの基礎（ツール・フック・ループ）"),
        (C_RESEARCH, 1, 14, "複数エージェント（委任・並列・統合）"),
        (C_EXTRACT,  2, 21, "構造化抽出（スキーマ・検証・バッチ）"),
        (C_CONFIG,   3, 28, "Claude Code 設定（CLAUDE.md・ルール・MCP）"),
    ]
    for cid, order, days, label in items:
        b.sb(env, "POST", "path_items", {
            "path_id": pid, "course_id": cid, "sort_order": order,
            "target_days": days, "milestone_label": label})
        print(f"    item[{order}] +{days}日  {label}")

    for uid in MEMBERS:
        b.sb(env, "POST", "path_enrollments", {"user_id": uid, "path_id": pid, "status": "active"})
    print(f"  path受講登録: {len(MEMBERS)}名")
    print("完成 🎓  /journey で確認できます")


if __name__ == "__main__":
    main()
