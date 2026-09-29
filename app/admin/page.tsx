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
          {/* ロゴ + キャッチ（pipon ブランド：青ヘキサゴン＋ネットワーク＋オレンジのアクセント） */}
          <div className="flex flex-col items-center">
            <svg width="92" height="92" viewBox="0 0 100 100" aria-hidden>
              <defs>
                <linearGradient id="piponHex" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5cb1e2" />
                  <stop offset="100%" stopColor="#17579a" />
                </linearGradient>
              </defs>
              {/* ヘキサゴン */}
              <path
                d="M50 8 L86 29 L86 71 L50 92 L14 71 L14 29 Z"
                fill="none" stroke="url(#piponHex)" strokeWidth="7" strokeLinejoin="round"
              />
              {/* ネットワーク */}
              <g stroke="#2f86c5" strokeWidth="2.4" strokeLinecap="round">
                <line x1="50" y1="52" x2="37" y2="39" />
                <line x1="50" y1="52" x2="64" y2="42" />
                <line x1="50" y1="52" x2="50" y2="75" />
              </g>
              <g fill="#2f86c5">
                <rect x="33" y="35" width="8" height="8" rx="1.5" />
                <rect x="60" y="38" width="8" height="8" rx="1.5" />
                <rect x="45" y="47" width="10" height="10" rx="2" />
                <circle cx="50" cy="77" r="4" />
              </g>
              {/* オレンジのアクセント */}
              <g fill="#f0a11f">
                <circle cx="41" cy="52" r="3.2" />
                <circle cx="61" cy="56" r="3.2" />
              </g>
            </svg>
            <div className="mt-3 text-4xl font-extrabold tracking-tight">
              <span style={{ color: '#2b2b2b' }}>pipon</span>{' '}
              <span style={{ color: '#1c6fb0' }}>learning</span>
            </div>
            <p className="mt-1 text-sm text-gray-500">- 株式会社pipon 社内教育プラットフォーム -</p>
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
