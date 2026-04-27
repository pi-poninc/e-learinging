import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
          <h1 className="text-xl font-bold text-blue-600">E-Learning</h1>
          <div className="flex gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              ログイン
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              無料で始める
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h2 className="text-4xl font-bold text-gray-900 mb-6">
          いつでも、どこでも、学べる。
        </h2>
        <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
          動画で学ぶオンライン学習プラットフォーム。
          あなたのペースで、スキルアップを始めましょう。
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/signup"
            className="inline-flex items-center px-6 py-3 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700"
          >
            アカウント作成
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center px-6 py-3 rounded-md border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
          >
            ログイン
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">動画レッスン</h3>
              <p className="text-gray-600">高品質な動画コンテンツで、効率的に学習できます。</p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">進捗管理</h3>
              <p className="text-gray-600">学習の進み具合を確認しながら、着実にステップアップ。</p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">いつでもアクセス</h3>
              <p className="text-gray-600">PCでもスマホでも、好きな時間に学習できます。</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
