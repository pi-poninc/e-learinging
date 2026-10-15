import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { skillMapEnabled } from '@/lib/flags'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { CaseMaterialAdmin } from '@/components/review/case-material-admin'
import { notFound } from 'next/navigation'

// 個人情報らしき文字列の簡易検知（最終判断は人）
const PII = /([\w.+-]+@[\w-]+\.[\w.-]+)|(0\d{1,4}-?\d{1,4}-?\d{3,4})/

export default async function AdminCaseMaterialsPage() {
  if (!skillMapEnabled()) notFound()
  await requireStaff()
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('case_materials').select('id, title, background, anonymization_status').order('created_at', { ascending: false })

  const items = (rows || []).map((r) => ({
    id: r.id, title: r.title, background: r.background,
    anonymization_status: r.anonymization_status,
    piiWarning: PII.test(`${r.title} ${r.background || ''}`),
  }))

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">ケース教材</h1>
      <p className="text-sm text-gray-500 mb-6">実案件を匿名化した教材。<span className="font-medium">承認（approved）されるまで課題として公開できません</span>（DBでも強制）。</p>
      <CaseMaterialAdmin items={items} />
    </AdminLayout>
  )
}
