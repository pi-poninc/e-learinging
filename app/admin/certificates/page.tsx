import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Table } from '@/components/ui/table'

export default async function AdminCertificatesPage() {
  await requireAdmin()
  const supabase = await createClient()

  const { data: certificates } = await supabase
    .from('certificates')
    .select('*, user:profiles(name), course:courses(title)')
    .order('issued_at', { ascending: false })

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">修了証管理</h1>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">発行済み修了証</h2>
        </CardHeader>
        <CardBody className="p-0">
          {!certificates || certificates.length === 0 ? (
            <p className="px-6 py-8 text-gray-500 text-center">修了証はまだ発行されていません。</p>
          ) : (
            <Table headers={['受講者', '講座', '証明書番号', '発行日', 'PDF']}>
              {certificates.map((cert) => {
                const userName = (cert.user as unknown as { name: string | null })?.name || '-'
                const courseTitle = (cert.course as unknown as { title: string })?.title || '-'
                return (
                  <tr key={cert.id}>
                    <td className="px-6 py-4 text-sm text-gray-900">{userName}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{courseTitle}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{cert.certificate_number}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(cert.issued_at).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {cert.pdf_url ? (
                        <a href={cert.pdf_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          ダウンロード
                        </a>
                      ) : '-'}
                    </td>
                  </tr>
                )
              })}
            </Table>
          )}
        </CardBody>
      </Card>
    </AdminLayout>
  )
}
