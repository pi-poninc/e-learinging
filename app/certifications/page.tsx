import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/permissions'
import { certificationEnabled } from '@/lib/flags'
import { StudentLayout } from '@/components/layouts/student-layout'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CertConsentToggle } from '@/components/review/cert-consent-toggle'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function MyCertificationsPage() {
  if (!certificationEnabled()) notFound()
  const profile = await requireAuth()
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('user_certifications')
    .select('id, status, certificate_number, issued_at, expires_at, public_consent, certification:certifications(name)')
    .eq('user_id', profile.id).order('issued_at', { ascending: false })

  return (
    <StudentLayout isAdmin={isAdmin(profile.role)}>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">認定</h1>
        <p className="text-sm text-gray-500 mb-6">取得した認定です。公開確認ページへの掲載は、あなたの同意がある場合だけ表示されます。</p>

        {(!rows || rows.filter((r) => r.status === 'approved').length === 0) && (
          <Card><CardBody><p className="text-sm text-gray-500">まだ発行された認定はありません。</p></CardBody></Card>
        )}

        <div className="space-y-3">
          {(rows || []).filter((r) => r.status === 'approved').map((r) => (
            <Card key={r.id}><CardBody>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{(r.certification as unknown as { name: string } | null)?.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    認定番号 {r.certificate_number}／発行 {r.issued_at ? new Date(r.issued_at).toLocaleDateString('ja-JP') : '—'}
                    {r.expires_at && `／有効期限 ${new Date(r.expires_at).toLocaleDateString('ja-JP')}`}
                  </p>
                </div>
                <Badge variant="success">認定</Badge>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <CertConsentToggle userCertId={r.id} initial={r.public_consent} />
                {r.public_consent && r.certificate_number && (
                  <Link href={`/verify/${r.certificate_number}`} className="text-sm text-blue-600 hover:text-blue-700">確認ページを見る →</Link>
                )}
              </div>
            </CardBody></Card>
          ))}
        </div>
      </div>
    </StudentLayout>
  )
}
