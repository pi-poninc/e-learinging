import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/permissions'
import { submissionReviewEnabled } from '@/lib/flags'
import { learningDay } from '@/lib/learning-day'
import { StudentLayout } from '@/components/layouts/student-layout'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function PracticePage() {
  if (!submissionReviewEnabled()) notFound()
  const profile = await requireAuth()
  const supabase = await createClient()

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('course_id, course:courses(id, title)')
    .eq('user_id', profile.id)
    .eq('status', 'active')

  const courseIds = (enrollments || []).map((e) => e.course_id)
  const courseTitle = new Map<string, string>()
  for (const e of enrollments || []) {
    const c = e.course as unknown as { id: string; title: string } | null
    if (c) courseTitle.set(e.course_id, c.title)
  }

  let tasks: { id: string; course_id: string; title: string; estimated_minutes: number | null }[] = []
  const submittedCourses = new Set<string>()
  if (courseIds.length > 0) {
    const { data: t } = await supabase
      .from('review_tasks')
      .select('id, course_id, title, estimated_minutes')
      .in('course_id', courseIds)
      .eq('is_active', true)
      .order('order_index')
    tasks = t || []

    const today = learningDay(new Date())
    const { data: subs } = await supabase
      .from('review_submissions')
      .select('course_id')
      .eq('user_id', profile.id)
      .eq('learning_day', today)
      .neq('status', 'draft')
    for (const s of subs || []) submittedCourses.add(s.course_id)
  }

  const byCourse = new Map<string, typeof tasks>()
  for (const t of tasks) {
    const arr = byCourse.get(t.course_id) || []
    arr.push(t)
    byCourse.set(t.course_id, arr)
  }

  return (
    <StudentLayout isAdmin={isAdmin(profile.role)}>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">練習（毎日の提出）</h1>
        <p className="text-sm text-gray-500 mb-6">毎日1つ、課題を提出しましょう。添削が返ってきます。</p>

        {tasks.length === 0 && (
          <Card><CardBody><p className="text-sm text-gray-500">提出できる課題はまだありません。</p></CardBody></Card>
        )}

        {[...byCourse.entries()].map(([cid, list]) => (
          <div key={cid} className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-lg font-semibold text-gray-800">{courseTitle.get(cid) || 'コース'}</h2>
              {submittedCourses.has(cid)
                ? <Badge variant="success">今日は提出済み</Badge>
                : <Badge variant="warning">今日の提出がまだ</Badge>}
            </div>
            <div className="space-y-2">
              {list.map((t) => (
                <Link key={t.id} href={`/practice/${t.id}`}>
                  <Card className="hover:shadow-md transition-shadow">
                    <CardBody>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{t.title}</span>
                        {t.estimated_minutes && (
                          <span className="text-xs text-gray-400">目安 {t.estimated_minutes} 分</span>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </StudentLayout>
  )
}
