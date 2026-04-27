import { requireAdmin } from '@/lib/auth'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'

export default async function AdminHelpPage() {
  await requireAdmin()

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">使い方ガイド</h1>

      {/* 全体の流れ */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold">講座公開までの流れ</h2>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
              <div>
                <h3 className="font-semibold text-gray-900">講座を作成</h3>
                <p className="text-sm text-gray-600 mt-1">
                  「講座管理」→「新規作成」からタイトルと説明を入力して講座を作ります。<br />
                  この時点ではステータスを「下書き」のままでOKです。
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
              <div>
                <h3 className="font-semibold text-gray-900">セクションを追加</h3>
                <p className="text-sm text-gray-600 mt-1">
                  講座の編集画面の下部にある「新しいセクション名」にセクション名（例：「第1章 基礎」）を入力して「セクション追加」を押します。<br />
                  セクションは講座内のグループ分けです。章やモジュールとして使います。
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
              <div>
                <h3 className="font-semibold text-gray-900">コンテンツを追加</h3>
                <p className="text-sm text-gray-600 mt-1">
                  各セクションの右側にあるボタンでコンテンツを追加します：
                </p>
                <ul className="text-sm text-gray-600 mt-2 ml-4 list-disc space-y-1">
                  <li><strong>+ レッスン</strong> — Vimeo動画を使った動画レッスン</li>
                  <li><strong>+ テスト</strong> — クイズ/テスト（4種類の問題形式）</li>
                  <li><strong>+ 課題</strong> — ファイル提出型の課題</li>
                </ul>
                <p className="text-sm text-gray-600 mt-2">
                  ボタンを押すと自動的に編集画面に移動します。
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
              <div>
                <h3 className="font-semibold text-gray-900">Vimeo動画を設定</h3>
                <p className="text-sm text-gray-600 mt-1">
                  レッスン編集画面で Vimeo URL（例：<code className="bg-gray-100 px-1 rounded">https://vimeo.com/123456789</code>）を入力します。<br />
                  「<strong>Vimeoから情報を取得</strong>」ボタンを押すと、動画のタイトルと長さが自動で入力されます。<br />
                  ステータスを「公開」にして保存してください。
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">5</div>
              <div>
                <h3 className="font-semibold text-gray-900">受講者を登録</h3>
                <p className="text-sm text-gray-600 mt-1">
                  「受講者管理」画面で、ユーザーと講座を選択して「登録」を押します。<br />
                  登録されたユーザーのダッシュボードに講座が表示されます。
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">6</div>
              <div>
                <h3 className="font-semibold text-gray-900">講座を公開</h3>
                <p className="text-sm text-gray-600 mt-1">
                  講座編集画面でステータスを「公開」に変更して保存します。<br />
                  受講登録済みのユーザーが講座にアクセスできるようになります。
                </p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* テストの作り方 */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold">テスト/クイズの作り方</h2>
        </CardHeader>
        <CardBody>
          <div className="space-y-3 text-sm text-gray-600">
            <p>セクション内の「+ テスト」ボタンを押すとテスト編集画面に移動します。</p>
            <ol className="list-decimal ml-5 space-y-2">
              <li><strong>基本情報を設定</strong>: タイトル、合格ライン（%）、制限時間（任意）を入力</li>
              <li><strong>問題を追加</strong>: 画面下部の4つのボタンから問題タイプを選択
                <ul className="list-disc ml-5 mt-1 space-y-1">
                  <li><strong>単一選択</strong> — 1つだけ正解を選ぶ問題</li>
                  <li><strong>複数選択</strong> — 複数の正解がある問題</li>
                  <li><strong>○×</strong> — 正しいか間違いかの2択</li>
                  <li><strong>並び替え</strong> — 正しい順番に並べる問題</li>
                </ul>
              </li>
              <li><strong>選択肢を編集</strong>: 各問題の選択肢テキストを入力し、正解にチェックを付ける</li>
              <li><strong>各問題の「保存」ボタンを押す</strong>（問題ごとに保存が必要です）</li>
              <li><strong>ステータスを「公開」にして保存</strong></li>
            </ol>
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-yellow-800 font-medium">ポイント</p>
              <ul className="text-yellow-700 mt-1 list-disc ml-5 space-y-1">
                <li>合格ラインはパーセントで設定します（例: 80 = 80%以上で合格）</li>
                <li>不合格の場合、受講者は何度でも再受験できます</li>
                <li>合格済みの場合、再受験ボタンは表示されません</li>
                <li>順序モードの講座では、テスト不合格だと次のコンテンツに進めません</li>
              </ul>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 課題の作り方 */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold">課題の作り方</h2>
        </CardHeader>
        <CardBody>
          <div className="space-y-3 text-sm text-gray-600">
            <p>セクション内の「+ 課題」ボタンを押すと課題編集画面に移動します。</p>
            <ol className="list-decimal ml-5 space-y-2">
              <li>タイトルと説明を入力</li>
              <li>許可するファイル形式（例: pdf, doc, zip）と最大サイズを設定</li>
              <li>ステータスを「公開」にして保存</li>
            </ol>
            <p className="mt-2">
              受講者が提出したファイルは「受講者管理」→「提出一覧」で確認・採点できます。<br />
              「承認」すると課題完了として扱われます。
            </p>
          </div>
        </CardBody>
      </Card>

      {/* 順序モード */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold">受講順序制御（順序モード）</h2>
        </CardHeader>
        <CardBody>
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              講座編集の「受講順序制御」を「順序モード」に設定すると、受講者は前のコンテンツを完了しないと次に進めなくなります。
            </p>
            <p>完了条件は以下の通りです：</p>
            <ul className="list-disc ml-5 space-y-1">
              <li><strong>レッスン</strong>: 動画の90%以上を視聴、または「完了」ボタンを押す</li>
              <li><strong>テスト</strong>: 合格ラインをクリアする</li>
              <li><strong>課題</strong>: 管理者が「承認」する</li>
            </ul>
          </div>
        </CardBody>
      </Card>

      {/* 修了証 */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold">修了証について</h2>
        </CardHeader>
        <CardBody>
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              講座内の全てのコンテンツ（レッスン、テスト、課題）が完了すると、修了証が自動的に発行されます。
            </p>
            <p>
              発行された修了証は「修了証管理」画面で一覧を確認でき、受講者はPDFをダウンロードできます。
            </p>
          </div>
        </CardBody>
      </Card>

      {/* 進捗確認 */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">進捗の確認方法</h2>
        </CardHeader>
        <CardBody>
          <div className="text-sm text-gray-600 space-y-2">
            <p>「進捗確認」画面で、受講者ごとの講座進捗をパーセントで確認できます。</p>
            <p>レッスン視聴、テスト合格、課題承認の全てが100%になると修了証が発行されます。</p>
          </div>
        </CardBody>
      </Card>
    </AdminLayout>
  )
}
