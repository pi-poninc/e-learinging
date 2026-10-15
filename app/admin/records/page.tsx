import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { certificationEnabled, orgAdminEnabled } from '@/lib/flags'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody } from '@/components/ui/card'
import { RecordExport } from '@/components/review/record-export'
import { notFound } from 'next/navigation'

export default async function AdminRecordsPage() {
  if (!certificationEnabled() && !orgAdminEnabled()) notFound()
  await requireStaff()
  const supabase = await createClient()
  const { data: courses } = await supabase.from('courses').select('id, title').eq('status', 'published').order('created_at', { ascending: false })

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">受講記録の出力</h1>
      <p className="text-sm text-gray-500 mb-6">
        提出件数・提出日数・添削受領数・学習時間（近似）・グレード・認定履歴をCSVで出力します。
        学習時間は提出ごとの目安時間を合算した近似値です（厳密な滞在時間ではありません）。助成金等での利用時は、必要項目を運営でご確認ください。
      </p>
      <Card><CardBody><RecordExport courses={(courses || []) as { id: string; title: string }[]} /></CardBody></Card>
    </AdminLayout>
  )
}
