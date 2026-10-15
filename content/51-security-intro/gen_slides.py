#!/usr/bin/env python3
"""セキュリティ基礎ダイジェスト動画スライド（9枚）。"""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _deck import build_deck  # noqa: E402

FOOT = "pipon learning ｜ セキュリティ基礎"

SLIDES = [
    {"type": "title", "kicker": "セキュリティ基礎ダイジェスト",
     "title": "全員の習慣で、自分と会社を守る",
     "sub": "むずかしい技術より、当たり前の徹底", "foot": FOOT},

    {"kicker": "なぜ？", "title": "狙いと、守る対象",
     "bullets": ["狙いはお金と情報（顧客データも）", "入口のほとんどは『人』（だます／弱いパスワード）", "当たり前を徹底すれば、大半は防げる"]},

    {"kicker": "① パスワード", "title": "使い回しをやめる",
     "bullets": ["使い回し厳禁（1つ漏れると連鎖）", "パスワードマネージャで生成・保管", "漏洩チェック（haveibeenpwned）"]},

    {"kicker": "② 2段階認証", "title": "漏れても止められる",
     "bullets": ["パスワード＋もう1つの確認", "認証アプリ・パスキー ＞ SMS", "メール・GitHub・銀行・会社から必ず"]},

    {"kicker": "③ フィッシング", "title": "だまされない",
     "bullets": ["差出人ドメイン・緊急の煽り・URLを疑う", "リンクから入らず、公式サイト/アプリから", "『振込先変更』は電話で本人確認（BEC）"]},

    {"kicker": "④ 端末", "title": "ロック・暗号化・更新",
     "bullets": ["画面ロック＋自動ロック", "ディスク暗号化（FileVault / BitLocker）", "OS・アプリを最新に／公衆Wi-Fiは慎重"]},

    {"kicker": "⑤ データ", "title": "最小限・貼らない・上げない",
     "bullets": ["顧客情報は必要な人だけ・共有範囲を確認", "生成AIに機密・個人情報を貼らない", "GitHub に APIキー/パスワードを上げない"]},

    {"kicker": "⑥ 備え＆対応", "title": "バックアップと、起きたとき",
     "bullets": ["3-2-1 バックアップ", "怪しい添付・マクロを開かない", "起きたら：ネット遮断 → パスワード変更 → 即報告（隠さない）"]},

    {"type": "title", "kicker": "今日から",
     "title": "使い回さない・2FA・疑う・貼らない・報告",
     "sub": "小さな習慣の積み重ねが、いちばん強い防御", "foot": FOOT},
]

if __name__ == "__main__":
    out = Path(__file__).resolve().parent
    build_deck(SLIDES, out / "slides.pptx")
    print(f"slides.pptx 生成: {len(SLIDES)}枚")
