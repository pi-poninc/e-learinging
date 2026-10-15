'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ReactNode } from 'react'

const navItems = [
  { href: '/admin', label: 'ダッシュボード' },
  { href: '/admin/courses', label: '講座管理' },
  { href: '/admin/paths', label: '学習ロードマップ' },
  { href: '/admin/users', label: 'ユーザー管理' },
  { href: '/admin/groups', label: 'グループ管理' },
  { href: '/admin/enrollments', label: '受講登録' },
  { href: '/admin/progress', label: '進捗確認' },
  { href: '/admin/reports', label: '進捗・成績レポート' },
  { href: '/admin/announcements', label: 'お知らせ配信' },
  { href: '/admin/reminders', label: '受講リマインド' },
  { href: '/admin/submissions', label: 'ネタ投稿管理' },
  { href: '/admin/certificates', label: '修了証管理' },
  { href: '/admin/help', label: '使い方ガイド' },
]

const reviewNavOn =
  process.env.NEXT_PUBLIC_FEATURE_SUBMISSION_REVIEW === 'true' ||
  process.env.NEXT_PUBLIC_FEATURE_SUBMISSION_REVIEW === '1'
const skillNavOn =
  process.env.NEXT_PUBLIC_FEATURE_SKILL_MAP === 'true' ||
  process.env.NEXT_PUBLIC_FEATURE_SKILL_MAP === '1'
const peerNavOn =
  process.env.NEXT_PUBLIC_FEATURE_PEER_REVIEW === 'true' ||
  process.env.NEXT_PUBLIC_FEATURE_PEER_REVIEW === '1'
const coachNavOn =
  process.env.NEXT_PUBLIC_FEATURE_AI_COACH === 'true' ||
  process.env.NEXT_PUBLIC_FEATURE_AI_COACH === '1'
const cohortNavOn =
  process.env.NEXT_PUBLIC_FEATURE_COHORT === 'true' ||
  process.env.NEXT_PUBLIC_FEATURE_COHORT === '1'

const extraNav = [
  ...(reviewNavOn ? [{ href: '/admin/review-queue', label: '添削キュー' }] : []),
  ...(skillNavOn ? [{ href: '/admin/grades', label: 'グレード承認' }, { href: '/admin/case-materials', label: 'ケース教材' }] : []),
  ...(peerNavOn ? [{ href: '/admin/reviewer-checks', label: '新任添削の確認' }, { href: '/admin/reviewer-candidates', label: '添削者の認定' }] : []),
  ...(coachNavOn ? [{ href: '/admin/coach-logs', label: 'AIコーチ ログ' }] : []),
  ...(cohortNavOn ? [{ href: '/admin/cohorts', label: 'コホート' }] : []),
]
const visibleNavItems = extraNav.length
  ? [...navItems.slice(0, 10), ...extraNav, ...navItems.slice(10)]
  : navItems

export function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <Link href="/admin" className="text-xl font-bold text-blue-600">
            pipon learning 管理
          </Link>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="px-4 py-4 border-t border-gray-200 space-y-1">
          <Link
            href="/dashboard"
            className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            受講者画面へ
          </Link>
          <button
            onClick={handleLogout}
            className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50"
          >
            ログアウト
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
