import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { certificationEnabled } from '@/lib/flags'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { CertCreateForm } from '@/components/review/cert-create-form'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function AdminCertificationsPage() {
  if (!certificationEnabled()) notFound()
  await requireStaff()
  const supabase = await createClient()

  const { data: certs } = await supabase.from('certifications').select('id, name, requirements, validity_months, course:courses(title)').order('created_at', { ascending: false })
  const { data: courses } = await supabase.from('courses').select('id, title').eq('status', 'published').order('created_at', { ascending: false })

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">認定</h1>
      <p className="text-sm text-gray-500 mb-6">条件を満たした受講者を、管理者の承認で発行します（自動では発行されません）。</p>

      <Card className="mb-6">
        <CardHeader><h2 className="text-lg font-semibold">認定を作成</h2></CardHeader>
        <CardBody><CertCreateForm courses={(courses || []) as { id: string; title: string }[]} /></CardBody>
      </Card>

      <div className="space-y-2">
        {(certs || []).map((c) => {
          const req = (c.requirements || {}) as { grade_level?: number; demo_day?: boolean }
          return (
            <Link key={c.id} href={`/admin/certifications/${c.id}`}>
              <Card className="hover:shadow-md transition-shadow"><CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-900">{c.name}</span>
                    <span className="text-sm text-gray-500 ml-2">{(c.course as unknown as { title: string } | null)?.title}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {req.grade_level ? `グレード${req.grade_level}` : ''}{req.demo_day ? '・デモデイ' : ''}{c.validity_months ? `・${c.validity_months}ヶ月` : '・無期限'}
                  </span>
                </div>
              </CardBody></Card>
            </Link>
          )
        })}
        {(certs || []).length === 0 && <Card><CardBody><p className="text-sm text-gray-500">認定はまだありません。</p></CardBody></Card>}
      </div>
    </AdminLayout>
  )
}
