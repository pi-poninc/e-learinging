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

## ワンコマンド量産（build.py）

スライド・台本・ナレーション音声が揃ったら、合成→Vimeoアップ→e-learning登録まで一発：

```bash
# 台本から自分の声(Fish Audio)でナレーション生成→合成→アップ→登録まで全自動
python3 content/build.py content/02-xxx \
  --voice <Fish声モデルID> \
  --course "社内ナレッジ / FDE編" --title "レッスン名" --desc "説明"

# 音声を手動で用意済み（narration.mp3を置いた）場合は --voice なしでOK
python3 content/build.py content/02-xxx \
  --course "社内ナレッジ / FDE編" --title "レッスン名" --desc "説明"

# 既存レッスンに動画を登録／差し替え
python3 content/build.py content/02-xxx --lesson <lesson_id>

# 音声だけ差し替えて作り直す等（合成済みwork/を再利用しないで作り直す場合は素の実行）
python3 content/build.py content/02-xxx --lesson <lesson_id> --skip-prepare --skip-compose  # アップだけ
```

`.env.local` の `VIMEO_ACCESS_TOKEN`（upload権限）・`SUPABASE_SERVICE_ROLE_KEY`・`FISH_AUDIO_API_KEY` を自動で使う。
Vimeoは限定公開(unlisted)でアップされ、`lessons.vimeo_url` にはハッシュ付きURLが保存される。

### Fish Audio（自分の声）を使うための前提
- **声モデルの作成**: https://fish.audio/app/ で Premium Voice Clone を作り、そのモデルIDを `--voice` に渡す
- **APIクレジット**: TTS APIはプラットフォームとは別の「APIクレジット」を消費する。
  https://fish.audio/app/developers でチャージが必要（残高0だと 402 エラー）

## 必要ツール（初回のみ）

- ffmpeg, poppler(pdftoppm), LibreOffice(soffice), whisper.cpp(whisper-cli), Python3+Pillow+python-pptx
- whisperモデル: `~/.cache/whisper-cpp-models/ggml-large-v3-turbo.bin`
