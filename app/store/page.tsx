import { requireAuth } from '@/lib/auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { billingEnabled } from '@/lib/flags'
import { formatPriceJpy } from '@/lib/billing'
import { StudentLayout } from '@/components/layouts/student-layout'
import { Card, CardBody } from '@/components/ui/card'
import { BuyCourseButton } from '@/components/buy-course-button'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function StorePage() {
  if (!billingEnabled()) redirect('/dashboard')
  const profile = await requireAuth()
  const supabase = await createClient()

  // 有料・公開の講座
  const { data: courses } = await supabase
    .from('courses')
    .select('id, title, description, thumbnail_url, price_jpy')
    .eq('status', 'published')
    .gt('price_jpy', 0)
    .order('created_at', { ascending: false })

  // 受講中の講座（購入済み判定）
  const svc = await createServiceClient()
  const { data: enr } = await svc
    .from('enrollments').select('course_id').eq('user_id', profile.id).eq('status', 'active')
  const owned = new Set((enr || []).map((e) => e.course_id))

  const items = courses || []

  return (
    <StudentLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">講座ストア</h1>
      <p className="text-sm text-gray-600 mb-6">購入するとすぐに受講できます。</p>

      {items.length === 0 ? (
        <Card><CardBody><p className="text-gray-600">現在、販売中の講座はありません。</p></CardBody></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => {
            const has = owned.has(c.id)
            return (
              <Card key={c.id}>
                <CardBody className="flex flex-col gap-3">
                  <div>
                    <h2 className="font-semibold text-gray-900">{c.title}</h2>
                    {c.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-3">{c.description}</p>
                    )}
                  </div>
                  <p className="text-lg font-bold text-gray-900">{formatPriceJpy(c.price_jpy)}</p>
                  {has ? (
                    <Link href={`/courses/${c.id}`} className="text-blue-600 text-sm font-medium">
                      受講する →（購入済み）
                    </Link>
                  ) : (
                    <BuyCourseButton courseId={c.id} label={`${formatPriceJpy(c.price_jpy)} で購入`} />
                  )}
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}
    </StudentLayout>
  )
}
