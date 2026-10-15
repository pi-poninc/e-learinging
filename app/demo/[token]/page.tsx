import { createServiceClient } from '@/lib/supabase/server'
import { cohortEnabled } from '@/lib/flags'
import { DemoEvalForm } from '@/components/review/demo-eval-form'
import { notFound } from 'next/navigation'

interface Props { params: Promise<{ token: string }> }

// ゲスト評価者向け。ログイン不要。middleware で /demo/ は公開。
export default async function GuestDemoPage({ params }: Props) {
  if (!cohortEnabled()) notFound()
  const { token } = await params
  const svc = await createServiceClient()

  const { data: tok } = await svc.from('demo_day_guest_tokens').select('cohort_id, expires_at, label').eq('token', token).maybeSingle()
  const expired = tok && new Date(tok.expires_at).getTime() < Date.now()

  if (!tok || expired) {
    return (
      <div className="min-h-screen bg-gray-50 grid place-items-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">デモデイ 評価</h1>
          <p className="text-sm text-gray-600">{!tok ? 'このURLは無効です。' : 'このURLは有効期限が切れています。主催者にお問い合わせください。'}</p>
        </div>
      </div>
    )
  }

  const { data: cohort } = await svc.from('cohorts').select('name, course_id').eq('id', tok.cohort_id).maybeSingle()
  const { data: entries } = await svc.from('demo_day_entries').select('id, user_id, title, description, video_url, demo_url').eq('cohort_id', tok.cohort_id)
  const names = new Map<string, string>()
  const uids = (entries || []).map((e: { user_id: string }) => e.user_id)
  if (uids.length) { const { data: p } = await svc.from('profiles').select('id, name').in('id', uids); for (const x of p || []) names.set(x.id, x.name || '発表者') }
  const { data: skills } = await svc.from('skills').select('id, name, skill_map:skill_maps!inner(course_id)').eq('skill_map.course_id', cohort?.course_id).order('order_index')
  const skillList = (skills || []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }))

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">デモデイ 評価（{cohort?.name}）</h1>
        <p className="text-sm text-gray-500 mb-6">発表をご覧いただき、評価とコメントをお願いします。ログインは不要です。</p>
        <div className="space-y-4">
          {(entries || []).map((e: { id: string; user_id: string; title: string; description: string | null; video_url: string | null; demo_url: string | null }) => (
            <div key={e.id} className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="font-semibold text-gray-900">{e.title}<span className="ml-2 text-xs text-gray-400">{names.get(e.user_id)}</span></h2>
              {e.description && <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{e.description}</p>}
              <div className="mt-2 flex gap-3 text-sm">
                {e.video_url && <a className="text-blue-600 underline" href={e.video_url} target="_blank" rel="noreferrer">デモ動画</a>}
                {e.demo_url && <a className="text-blue-600 underline" href={e.demo_url} target="_blank" rel="noreferrer">デモ</a>}
              </div>
              <div className="mt-4 border-t border-gray-100 pt-3">
                <DemoEvalForm entryId={e.id} skills={skillList} guestToken={token} />
              </div>
            </div>
          ))}
          {(entries || []).length === 0 && <p className="text-sm text-gray-500">まだ発表が登録されていません。</p>}
        </div>
      </div>
    </div>
  )
}
