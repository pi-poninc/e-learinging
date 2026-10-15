'use client'

import { useRouter } from 'next/navigation'

export function KpiCourseSelect({ courses, current }: { courses: { id: string; title: string }[]; current: string }) {
  const router = useRouter()
  return (
    <select
      className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      value={current}
      onChange={(e) => router.push(`/admin/kpi?courseId=${e.target.value}`)}
    >
      {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
    </select>
  )
}
