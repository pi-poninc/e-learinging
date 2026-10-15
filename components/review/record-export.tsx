'use client'

import { useState } from 'react'

export function RecordExport({ courses }: { courses: { id: string; title: string }[] }) {
  const [courseId, setCourseId] = useState(courses[0]?.id || '')
  return (
    <div className="flex items-end gap-3 flex-wrap">
      <div>
        <label className="block text-sm text-gray-600 mb-1">コース</label>
        <select className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>
      <a
        href={`/api/records/export?scope=course&courseId=${courseId}`}
        className={`rounded-md px-4 py-2 text-sm font-medium ${courseId ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 pointer-events-none'}`}
      >
        受講記録CSVをダウンロード
      </a>
    </div>
  )
}
