import { describe, it, expect } from 'vitest'
import { popularNextCourses } from './popular-next'

describe('popularNextCourses', () => {
  // A修了者 {u1,u2,u3}。そのうち B も修了 {u1,u2}、C も修了 {u1}。
  const completers = {
    A: new Set(['u1', 'u2', 'u3']),
    B: new Set(['u1', 'u2', 'u5']),
    C: new Set(['u1', 'u9']),
    D: new Set(['u7']),
  }

  it('Aを修了した対象に、共起の多いBを最優先で薦める', () => {
    const r = popularNextCourses(completers, new Set(['A']))
    expect(r[0].courseId).toBe('B')
    expect(r[0].coCompleters).toBe(2) // u1,u2
    expect(r.find((x) => x.courseId === 'C')?.coCompleters).toBe(1)
  })

  it('既に修了済みの講座は候補から除外', () => {
    const r = popularNextCourses(completers, new Set(['A', 'B']))
    expect(r.find((x) => x.courseId === 'B')).toBeUndefined()
  })

  it('共起がない対象には何も出ない', () => {
    const r = popularNextCourses(completers, new Set(['D']))
    // D修了者 u7 は他講座を修了していない → 共起なし
    expect(r).toHaveLength(0)
  })

  it('minCoCompleters でノイズを除去できる', () => {
    const r = popularNextCourses(completers, new Set(['A']), 3, 2)
    // 共起2人以上は B のみ
    expect(r.map((x) => x.courseId)).toEqual(['B'])
  })

  it('limit で件数を絞る', () => {
    const r = popularNextCourses(completers, new Set(['A']), 1)
    expect(r).toHaveLength(1)
  })
})
