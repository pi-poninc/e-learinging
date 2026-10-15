'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ReactNode } from 'react'

interface StudentLayoutProps {
  children: ReactNode
  isAdmin?: boolean
  showTeam?: boolean
}

const practiceNavOn =
  process.env.NEXT_PUBLIC_FEATURE_SUBMISSION_REVIEW === 'true' ||
  process.env.NEXT_PUBLIC_FEATURE_SUBMISSION_REVIEW === '1'
const skillNavOn =
  process.env.NEXT_PUBLIC_FEATURE_SKILL_MAP === 'true' ||
  process.env.NEXT_PUBLIC_FEATURE_SKILL_MAP === '1'
const peerNavOn =
  process.env.NEXT_PUBLIC_FEATURE_PEER_REVIEW === 'true' ||
  process.env.NEXT_PUBLIC_FEATURE_PEER_REVIEW === '1'
const cohortNavOn =
  process.env.NEXT_PUBLIC_FEATURE_COHORT === 'true' ||
  process.env.NEXT_PUBLIC_FEATURE_COHORT === '1'
const certNavOn =
  process.env.NEXT_PUBLIC_FEATURE_CERTIFICATION === 'true' ||
  process.env.NEXT_PUBLIC_FEATURE_CERTIFICATION === '1'
const orgNavOn =
  process.env.NEXT_PUBLIC_FEATURE_ORG_ADMIN === 'true' ||
  process.env.NEXT_PUBLIC_FEATURE_ORG_ADMIN === '1'
const storeNavOn =
  process.env.NEXT_PUBLIC_FEATURE_BILLING === 'true' ||
  process.env.NEXT_PUBLIC_FEATURE_BILLING === '1'

export function StudentLayout({ children, isAdmin = false, showTeam = false }: StudentLayoutProps) {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="text-xl font-bold text-blue-600">
              pipon learning
            </Link>
            <div className="flex items-center gap-4">
              {isAdmin && (
                <Link
                  href="/admin"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  管理画面
                </Link>
              )}
              {showTeam && (
                <Link
                  href="/team"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  チーム
                </Link>
              )}
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                マイコース
              </Link>
              <Link
                href="/journey"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                FDEロードマップ
              </Link>
              {practiceNavOn && (
                <Link
                  href="/practice"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  練習（提出）
                </Link>
              )}
              {skillNavOn && (
                <Link
                  href="/skills"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  成長（スキル）
                </Link>
              )}
              {peerNavOn && (
                <Link
                  href="/practice/peer"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  ピアレビュー
                </Link>
              )}
              {cohortNavOn && (
                <Link
                  href="/cohort"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  仲間
                </Link>
              )}
              {certNavOn && (
                <Link
                  href="/certifications"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  認定
                </Link>
              )}
              {orgNavOn && (
                <Link
                  href="/org"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  組織
                </Link>
              )}
              {storeNavOn && (
                <Link
                  href="/store"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  ストア
                </Link>
              )}
              <Link
                href="/submit"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                ネタ投稿
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-red-600 hover:text-red-700"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
