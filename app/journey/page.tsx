import { requireAuth } from '@/lib/auth'
import { isAdmin } from '@/lib/permissions'
import { StudentLayout } from '@/components/layouts/student-layout'
import { JourneyClient } from '@/components/journey-client'

export default async function JourneyPage() {
  const profile = await requireAuth()
  const admin = isAdmin(profile.role)

  return (
    <StudentLayout isAdmin={admin}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">FDE育成ロードマップ</h1>
        <p className="text-sm text-gray-500 mt-1">
          コースを順番に進めて、FDEレベルを上げていこう。レッスン・クイズ・案件追体験・課題の完了がXPになります。
        </p>
      </div>
      <JourneyClient />
    </StudentLayout>
  )
}
