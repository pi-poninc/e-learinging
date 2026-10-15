import { createServiceClient } from '@/lib/supabase/server'
import { certificationEnabled } from '@/lib/flags'
import { notFound } from 'next/navigation'

interface Props { params: Promise<{ number: string }> }

// 認定番号の公開確認ページ。ログイン不要。本人が公開同意した approved のみ表示。
export default async function VerifyPage({ params }: Props) {
  if (!certificationEnabled()) notFound()
  const { number } = await params
  const svc = await createServiceClient()

  const { data: uc } = await svc.from('user_certifications')
    .select('user_id, status, public_consent, issued_at, expires_at, certification:certifications(name)')
    .eq('certificate_number', number).maybeSingle()

  const valid = uc && uc.status === 'approved' && uc.public_consent
  let name = ''
  if (valid) {
    const { data: p } = await svc.from('profiles').select('name').eq('id', uc.user_id).maybeSingle()
    name = p?.name || ''
  }
  const expired = valid && uc.expires_at && new Date(uc.expires_at).getTime() < Date.now()

  return (
    <div className="min-h-screen bg-gray-50 grid place-items-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="text-xs font-mono tracking-widest text-gray-400 uppercase mb-3">Certificate Verification</div>
        {valid ? (
          <>
            <div className="text-4xl mb-3">🏅</div>
            <p className="text-sm text-gray-500">この認定は有効です{expired ? '（ただし有効期限切れ）' : ''}。</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">{(uc.certification as unknown as { name: string } | null)?.name}</h1>
            <p className="text-lg text-gray-800 mt-2">{name} 様</p>
            <p className="text-xs text-gray-500 mt-4">
              認定番号 {number}／発行 {uc.issued_at ? new Date(uc.issued_at).toLocaleDateString('ja-JP') : '—'}
              {uc.expires_at && `／有効期限 ${new Date(uc.expires_at).toLocaleDateString('ja-JP')}`}
            </p>
          </>
        ) : (
          <>
            <div className="text-4xl mb-3">🔎</div>
            <p className="text-sm text-gray-600">この番号の認定は確認できませんでした。（無効、または本人が公開に同意していません）</p>
            <p className="text-xs text-gray-400 mt-3 font-mono">{number}</p>
          </>
        )}
      </div>
    </div>
  )
}
