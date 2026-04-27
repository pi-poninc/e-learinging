import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { StudentLayout } from '@/components/layouts/student-layout'
import { isAdmin } from '@/lib/permissions'
import { Card, CardBody } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ certificateId: string }>
}

export default async function CertificatePage({ params }: Props) {
  const { certificateId } = await params
  const profile = await requireAuth()
  const supabase = await createClient()
  const admin = isAdmin(profile.role)

  const { data: cert } = await supabase
    .from('certificates')
    .select('*, user:profiles(name), course:courses(title)')
    .eq('id', certificateId)
    .single()

  if (!cert) notFound()

  const userName = (cert.user as unknown as { name: string | null })?.name || ''
  const courseTitle = (cert.course as unknown as { title: string })?.title || ''

  return (
    <StudentLayout isAdmin={admin}>
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardBody className="text-center py-12">
            <div className="mb-8">
              <p className="text-blue-600 text-sm font-medium mb-2">CERTIFICATE OF COMPLETION</p>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{courseTitle}</h1>
              <p className="text-gray-500">修了証番号: {cert.certificate_number}</p>
            </div>

            <div className="mb-8">
              <p className="text-gray-500 mb-1">受講者</p>
              <p className="text-2xl font-semibold text-gray-900">{userName}</p>
            </div>

            <div className="mb-8">
              <p className="text-gray-500 mb-1">発行日</p>
              <p className="text-gray-900">
                {new Date(cert.issued_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {cert.pdf_url ? (
              <a href={cert.pdf_url} target="_blank" rel="noopener noreferrer">
                <Button>PDFをダウンロード</Button>
              </a>
            ) : (
              <p className="text-sm text-gray-400">PDF生成中...</p>
            )}
          </CardBody>
        </Card>

        <div className="mt-4 text-center">
          <Link href="/dashboard" className="text-sm text-blue-600 hover:text-blue-700">
            &larr; ダッシュボードに戻る
          </Link>
        </div>
      </div>
    </StudentLayout>
  )
}
