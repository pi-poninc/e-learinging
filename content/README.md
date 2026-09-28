# content — メモから教育動画を量産する

仕事のメモ（FDE的な気づき・ナレッジ）を、新入社員向けの eラーニング動画にして
`e-learning` サイトで受講・進捗管理するためのワークスペース。

## 1本あたりのフォルダ構成

```
content/<番号>-<スラッグ>/
  memo.md            ← 入力：仕事のラフなメモ（これだけ書けばOK）
  slides.pptx        ← 生成：スライド（1スライド=1メッセージ）
  script_台本_cc.md   ← 生成：スライド番号×ナレーション文（行数=スライド枚数）
  narration.mp3      ← 音声：Fish Audioの自分の声（or 仮でmacOS音声）
  wipe.mp4           ← 任意：HeyGenのアバター動画 or 画面録画
  output.mp4         ← 完成：合成済み動画（→ Vimeoにアップ）
  gen_slides.py      ← そのスライドを生成したスクリプト（再生成用）
```

## 制作フロー（AI_eラーニング制作マニュアル.pptx より）

1. **メモを書く** → `memo.md`
2. **Claudeがスライド＋台本を生成** → `slides.pptx` / `script_台本_cc.md`
3. **Fish Audio** で自分の声のナレーションを生成 → `narration.mp3`
4. （任意）**HeyGen** でアバター動画 → `wipe.mp4`
5. **`/video-elearning-compose` スキルで合成** → `output.mp4`
6. **Vimeo にアップロード** → URLを取得
7. **e-learning 管理画面**（`/admin/lessons`）でレッスンにVimeo URLを登録
8. 新入社員が受講 → 進捗が自動記録

## 必要ツール（初回のみ）

- ffmpeg, poppler(pdftoppm), LibreOffice(soffice), whisper.cpp(whisper-cli), Python3+Pillow+python-pptx
- whisperモデル: `~/.cache/whisper-cpp-models/ggml-large-v3-turbo.bin`
