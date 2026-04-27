'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ReactNode } from 'react'

const navItems = [
  { href: '/admin', label: 'ダッシュボード' },
  { href: '/admin/courses', label: '講座管理' },
  { href: '/admin/enrollments', label: '受講者管理' },
  { href: '/admin/progress', label: '進捗確認' },
  { href: '/admin/certificates', label: '修了証管理' },
]

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
            E-Learning Admin
          </Link>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => {
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
