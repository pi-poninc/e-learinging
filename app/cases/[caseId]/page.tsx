import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/permissions'
import { StudentLayout } from '@/components/layouts/student-layout'
import { CasePlayer } from '@/components/case-player'
import { SmartNextButton } from '@/components/smart-next-button'
import type { CaseScenario } from '@/lib/db'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

interface Props {
  params: Promise<{ caseId: string }>
}

export default async function CasePage({ params }: Props) {
  const { caseId } = await params
  const profile = await requireAuth()
  const supabase = await createClient()
  const admin = isAdmin(profile.role)

  const { data: sim } = await supabase
    .from('case_simulations')
    .select(`
      *,
      section:sections (
        id, title, course_id,
        course:courses (id, title)
      )
    `)
    .eq('id', caseId)
    .single()

  if (!sim) notFound()

  const section = sim.section as unknown as {
    id: string; title: string; course_id: string
    course: { id: string; title: string }
  }

  if (!admin && sim.status !== 'published') notFound()

  // Check enrollment for students
  if (!admin) {
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', profile.id)
      .eq('course_id', section.course_id)
      .eq('status', 'active')
      .single()

    if (!enrollment) redirect('/dashboard')
  }

  // Already completed?
  const { data: attempt } = await supabase
    .from('case_attempts')
    .select('completed')
    .eq('user_id', profile.id)
    .eq('case_simulation_id', caseId)
    .maybeSingle()

  const scenario = (sim.scenario || {}) as CaseScenario
  const hasScenes = Array.isArray(scenario.scenes) && scenario.scenes.length > 0

  return (
    <StudentLayout isAdmin={admin}>
      <div className="mb-4">
        <Link href={`/courses/${section.course_id}`} className="text-sm text-blue-600 hover:text-blue-700">
          &larr; {section.course.title} に戻る
        </Link>
      </div>

      <div className="max-w-3xl mx-auto">
        {hasScenes ? (
          <CasePlayer
            caseId={caseId}
            title={sim.title}
            scenario={scenario}
            alreadyCompleted={!!attempt?.completed}
            isAdmin={admin}
          />
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-8 text-center">
            <h2 className="text-xl font-bold text-gray-900">{sim.title}</h2>
            <p className="text-gray-500 mt-2">このシミュレーターはまだシナリオが登録されていません。</p>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <SmartNextButton courseId={section.course_id} currentItemId={caseId} currentItemType="case" />
        </div>
      </div>
    </StudentLayout>
  )
}
