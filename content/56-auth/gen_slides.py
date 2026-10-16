#!/usr/bin/env python3
"""認証設計シリーズ ダイジェスト動画スライド（7枚）。"""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _deck import build_deck  # noqa: E402

FOOT = "pipon learning ｜ 認証設計シリーズ"

SLIDES = [
    {"type": "title", "kicker": "認証設計シリーズ ダイジェスト",
     "title": "要件定義から鍵ローテまで",
     "sub": "後から直しにくい認証を、最初に決め切る", "foot": FOOT},

    {"kicker": "前提", "title": "認証と認可を分ける",
     "bullets": ["認証＝誰か を確かめる（ログイン）", "認可＝何をしてよいか を決める（権限）", "混ぜると設計が崩れる"]},

    {"kicker": "① 要件", "title": "決め忘れをなくす",
     "bullets": ["ログイン手段・PWポリシー", "ロック条件/解除/失敗リセット", "リセット・MFA・通知・セッション・退会"]},

    {"kicker": "② 方式", "title": "主要方式＋足せる余地",
     "rows": [("メール+PW", "慣れ。使い回し対策必須"), ("マジックリンク", "PW不要。到達性/期限"), ("パスキー", "フィッシングに強い"), ("ソーシャル", "登録が速い。退会扱い")]},

    {"kicker": "③ 実装", "title": "作らず選ぶ",
     "bullets": ["PW保管・MFA等は事故が致命的", "認証ライブラリ／IDプロバイダに任せる", "必要な方式・SSO・運用で選ぶ"]},

    {"kicker": "④ サービス間", "title": "内部JWTとBFF",
     "bullets": ["内部も“正規の呼び出しか”を検証", "秘密鍵で署名→公開鍵で検証(iss/aud/exp)", "BFFが外部→内部トークンに橋渡し"]},

    {"type": "title", "kicker": "⑤ 鍵ローテ｜まとめ",
     "title": "JWKS新旧併存で無停止交換",
     "sub": "kidで識別・オーバーラップは有効期限より長く。鍵は替える前提で", "foot": FOOT},
]

if __name__ == "__main__":
    out = Path(__file__).resolve().parent
    build_deck(SLIDES, out / "slides.pptx")
    print(f"slides.pptx 生成: {len(SLIDES)}枚")
