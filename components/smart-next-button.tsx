'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { CourseItem } from '@/lib/db'

interface SmartNextButtonProps {
  courseId: string
  currentItemId: string
  currentItemType: 'lesson' | 'quiz' | 'assignment' | 'case'
}

const typeLabels = {
  lesson: '次のレッスンへ',
  quiz: 'テストへ進む',
  assignment: '課題へ進む',
  case: '案件シミュレーターへ進む',
}

function itemUrl(item: CourseItem) {
  switch (item.type) {
    case 'lesson': return `/lessons/${item.id}`
    case 'quiz': return `/quizzes/${item.id}`
    case 'assignment': return `/assignments/${item.id}`
    case 'case': return `/cases/${item.id}`
  }
}

export function SmartNextButton({ courseId, currentItemId, currentItemType }: SmartNextButtonProps) {
  const [nextItem, setNextItem] = useState<CourseItem | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/course-items?courseId=${courseId}`)
        if (!res.ok) { setLoading(false); return }
        const { items } = await res.json() as { items: CourseItem[] }

        const currentIdx = items.findIndex((i) => i.id === currentItemId && i.type === currentItemType)
        if (currentIdx >= 0 && currentIdx < items.length - 1) {
          const next = items[currentIdx + 1]
          if (!next.locked) setNextItem(next)
        }
      } catch {
        // silent
      }
      setLoading(false)
    }
    load()
  }, [courseId, currentItemId, currentItemType])

  if (loading || !nextItem) return null

  return (
    <Link
      href={itemUrl(nextItem)}
      className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
    >
      {typeLabels[nextItem.type]} &rarr;
    </Link>
  )
}
