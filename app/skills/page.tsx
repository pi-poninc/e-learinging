import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/permissions'
import { skillMapEnabled } from '@/lib/flags'
import { computeSkillLevel, AssessmentInput } from '@/lib/review/skill-levels'
import { StudentLayout } from '@/components/layouts/student-layout'
import { SkillRadar } from '@/components/review/skill-radar'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { notFound } from 'next/navigation'

export default async function SkillsPage() {
  if (!skillMapEnabled()) notFound()
  const profile = await requireAuth()
  const supabase = await createClient()

  const { data: enrollments } = await supabase
    .from('enrollments').select('course_id').eq('user_id', profile.id).eq('status', 'active')
  const courseIds = (enrollments || []).map((e) => e.course_id)

  if (courseIds.length === 0) {
    return <StudentLayout isAdmin={isAdmin(profile.role)}><Empty /></StudentLayout>
  }

  const { data: maps } = await supabase
    .from('skill_maps').select('id, course_id, name, course:courses(title)')
    .in('course_id', courseIds).eq('is_active', true).limit(1)
  const map = maps?.[0]
  if (!map) {
    return <StudentLayout isAdmin={isAdmin(profile.role)}><Empty /></StudentLayout>
  }
  const courseName = (map.course as unknown as { title: string } | null)?.title || ''

  const { data: skills } = await supabase
    .from('skills').select('id, category, name, order_index').eq('skill_map_id', map.id).order('order_index')
  const skillIds = (skills || []).map((s) => s.id)

  const { data: levelDefs } = await supabase
    .from('skill_levels').select('skill_id, level, behavior_description').in('skill_id', skillIds.length ? skillIds : ['00000000-0000-0000-0000-000000000000'])

  const { data: assessments } = await supabase
    .from('skill_assessments').select('skill_id, level_observed, source_type, assessed_at')
    .eq('user_id', profile.id).in('skill_id', skillIds.length ? skillIds : ['00000000-0000-0000-0000-000000000000'])

  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const bySkill = new Map<string, AssessmentInput[]>()
  for (const a of assessments || []) {
    const arr = bySkill.get(a.skill_id) || []
    arr.push({ level_observed: a.level_observed, source_type: a.source_type, assessed_at: a.assessed_at })
    bySkill.set(a.skill_id, arr)
  }

  const rows = (skills || []).map((s) => {
    const all = bySkill.get(s.id) || []
    const now = computeSkillLevel(all)
    const past = computeSkillLevel(all.filter((a) => a.assessed_at <= cutoff))
    const nextLv = now.level === null ? 1 : Math.min(5, Math.floor(now.level) + 1)
    const nextDef = (levelDefs || []).find((d) => d.skill_id === s.id && d.level === nextLv)
    const remainForConfidence = now.confidence === 'low' ? Math.max(0, 3 - now.count) : 0
    return { skill: s, now, past, nextLv, nextDef, remainForConfidence }
  })

  // グレード
  const { data: ug } = await supabase
    .from('user_grades').select('status, grade:grades(name, level, course_id)').eq('user_id', profile.id)
  const myGrades = (ug || []).map((g) => ({ status: g.status, grade: g.grade as unknown as { name: string; level: number; course_id: string } | null }))
    .filter((g) => g.grade && g.grade.course_id === map.course_id)
  const approved = myGrades.filter((g) => g.status === 'approved').sort((a, b) => (b.grade!.level - a.grade!.level))[0]
  const eligible = myGrades.filter((g) => g.status === 'eligible').sort((a, b) => (b.grade!.level - a.grade!.level))[0]

  return (
    <StudentLayout isAdmin={isAdmin(profile.role)}>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">成長（スキルマップ）</h1>
        <p className="text-sm text-gray-500 mb-6">{courseName}｜青が現在、点線が1ヶ月前。伸びた部分を見てみましょう。</p>

        {approved && (
          <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
            現在のグレード：<span className="font-bold">{approved.grade!.name}</span>
          </div>
        )}
        {eligible && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
            🎉 次のグレード「{eligible.grade!.name}」の条件を満たしました。講師の承認をお待ちください。
          </div>
        )}

        <Card className="mb-6"><CardBody>
          <div className="flex justify-center">
            <SkillRadar axes={rows.map((r) => r.skill.name)} current={rows.map((r) => r.now.level)} past={rows.map((r) => r.past.level)} />
          </div>
        </CardBody></Card>

        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.skill.id}><CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-400">{r.skill.category}</span>
                  <p className="font-medium text-gray-900">{r.skill.name}</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-blue-600">{r.now.level ?? '—'}</span>
                  <span className="text-sm text-gray-400"> / 5</span>
                  <div><Badge variant={r.now.confidence === 'high' ? 'success' : r.now.confidence === 'medium' ? 'info' : 'default'}>確度 {r.now.confidence}</Badge></div>
                </div>
              </div>
              {r.nextDef && (
                <p className="text-xs text-gray-500 mt-2">
                  次（Lv{r.nextLv}）：{r.nextDef.behavior_description}
                  {r.remainForConfidence > 0 && <span className="text-orange-600">（あと評価{r.remainForConfidence}回で判定対象に）</span>}
                </p>
              )}
            </CardBody></Card>
          ))}
        </div>
      </div>
    </StudentLayout>
  )
}

function Empty() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">成長（スキルマップ）</h1>
      <Card><CardBody><p className="text-sm text-gray-500">このコースにはまだスキルマップがありません。</p></CardBody></Card>
    </div>
  )
}
