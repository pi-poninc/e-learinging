import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { AdminLayout } from '@/components/layouts/admin-layout'

export default async function AdminDashboardPage() {
  await requireAdmin()
  const supabase = await createClient()

  const [
    { count: studentsCount },
    { count: publishedCoursesCount },
    { count: completedCount },
    { count: inProgressCount },
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('courses').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  const students = studentsCount || 0
  const courses = publishedCoursesCount || 0
  const completed = completedCount || 0
  const inProgress = inProgressCount || 0

  const tiles = [
    { label: '受講者数', value: `${students} 人`, color: '#2d76b0' },
    { label: '公開コース数', value: `${courses} コース`, color: '#7a3f9d' },
    { label: '修了済み', value: `${completed} 件`, color: '#3ea24a' },
    { label: '進行中', value: `${inProgress} 件`, color: '#f0a11f' },
  ]

  // ドーナツ（修了済み / 進行中）
  const total = completed + inProgress
  const donePct = total ? (completed / total) * 100 : 0
  const progPct = total ? (inProgress / total) * 100 : 0

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">ダッシュボード</h1>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-700">ダッシュボード</h2>
        </div>

        <div className="px-6 py-8">
          {/* ロゴ + キャッチ */}
          <div className="flex flex-col items-center">
            <svg width="96" height="96" viewBox="0 0 64 64" aria-hidden className="text-gray-900">
              <path
                d="M32 6 L58 26 L52 26 L52 30 L12 30 L12 26 L6 26 Z"
                fill="currentColor"
              />
              <path
                d="M16 32 L24 32 L24 46 a8 8 0 0 0 16 0 L40 32 L48 32 L48 46 a16 16 0 0 1 -32 0 Z"
                fill="currentColor"
              />
            </svg>
            <div className="mt-2 text-4xl font-extrabold tracking-wide" style={{ color: '#f0821e' }}>
              ULearning
            </div>
            <p className="mt-1 text-sm text-gray-500">-誰でも気軽にeラーニング導入-</p>
          </div>

          {/* 4つのstatタイル */}
          <div className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
            {tiles.map((t) => (
              <div
                key={t.label}
                className="flex items-center justify-center rounded-md px-6 py-5 text-white shadow-sm"
                style={{ backgroundColor: t.color }}
              >
                <span className="text-lg font-bold">
                  {t.label}: {t.value}
                </span>
              </div>
            ))}
          </div>

          {/* ドーナツ（修了済み / 進行中） */}
          <div className="mt-10 flex flex-col items-center">
            <svg width="200" height="200" viewBox="0 0 42 42">
              <circle cx="21" cy="21" r="15.915" fill="none" stroke="#eceff1" strokeWidth="5" />
              {total > 0 && (
                <>
                  <circle
                    cx="21" cy="21" r="15.915" fill="none" stroke="#3ea24a" strokeWidth="5"
                    strokeDasharray={`${donePct} ${100 - donePct}`} strokeDashoffset="25"
                  />
                  <circle
                    cx="21" cy="21" r="15.915" fill="none" stroke="#f0a11f" strokeWidth="5"
                    strokeDasharray={`${progPct} ${100 - progPct}`} strokeDashoffset={`${25 - donePct}`}
                  />
                </>
              )}
              <text x="21" y="20.5" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#374151">
                {total}
              </text>
              <text x="21" y="26" textAnchor="middle" fontSize="2.6" fill="#9ca3af">
                受講登録
              </text>
            </svg>
            <div className="mt-4 flex gap-6 text-sm">
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: '#3ea24a' }} />
                修了済み
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: '#f0a11f' }} />
                進行中
              </span>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
