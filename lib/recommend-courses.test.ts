import { describe, it, expect } from 'vitest'
import { recommendNextCourses, type PathLite, type CompletionMap } from './recommend-courses'

const titles = { git: 'はじめてのGitとコマンド', sec: 'セキュリティ基礎', term: 'ターミナル入門', vs: 'VS Code入門', fde: 'FDEスクール' }

const devPath: PathLite = {
  id: 'p-dev', title: '開発ツール入門ロードマップ',
  items: [
    { courseId: 'term', sortOrder: 0, milestone: null },
    { courseId: 'vs', sortOrder: 1, milestone: null },
    { courseId: 'git', sortOrder: 3, milestone: null },
    { courseId: 'sec', sortOrder: 4, milestone: null },
  ],
}

describe('recommendNextCourses', () => {
  it('修了した講座の次（未修了・直前修了済み）を薦める', () => {
    // term/vs/git 修了、sec 未修了 → sec を薦める
    const comp: CompletionMap = {
      term: { total: 3, done: 3 }, vs: { total: 3, done: 3 },
      git: { total: 6, done: 6 }, sec: { total: 5, done: 0 },
    }
    const recos = recommendNextCourses([devPath], comp, titles)
    expect(recos).toHaveLength(1)
    expect(recos[0].courseId).toBe('sec')
    expect(recos[0].reason).toContain('はじめてのGitとコマンド')
  })

  it('まだ1本も修了していないロードマップは薦めない（次の文脈でない）', () => {
    const comp: CompletionMap = { term: { total: 3, done: 0 } }
    expect(recommendNextCourses([devPath], comp, titles)).toHaveLength(0)
  })

  it('完走済みロードマップからは何も出ない', () => {
    const comp: CompletionMap = {
      term: { total: 3, done: 3 }, vs: { total: 3, done: 3 },
      git: { total: 6, done: 6 }, sec: { total: 5, done: 5 },
    }
    expect(recommendNextCourses([devPath], comp, titles)).toHaveLength(0)
  })

  it('進捗率が高いロードマップを優先する', () => {
    const almost: PathLite = { id: 'p1', title: 'ほぼ完走', items: [
      { courseId: 'a', sortOrder: 0, milestone: null },
      { courseId: 'b', sortOrder: 1, milestone: null },
    ] }
    const early: PathLite = { id: 'p2', title: '始めたばかり', items: [
      { courseId: 'c', sortOrder: 0, milestone: null },
      { courseId: 'd', sortOrder: 1, milestone: null },
      { courseId: 'e', sortOrder: 2, milestone: null },
    ] }
    const comp: CompletionMap = {
      a: { total: 1, done: 1 }, b: { total: 1, done: 0 },
      c: { total: 1, done: 1 }, d: { total: 1, done: 0 }, e: { total: 1, done: 0 },
    }
    const recos = recommendNextCourses([early, almost], comp, { a: 'A', b: 'B', c: 'C', d: 'D', e: 'E' })
    expect(recos[0].courseId).toBe('b') // 50%完了のp1が先
  })

  it('手前を飛ばしていても、到達済みの最先端の“次”を薦める', () => {
    // git(index3)だけ完了、term/vs(手前)は未修了 → 手前ではなく sec(index4) を薦める
    const comp: CompletionMap = {
      term: { total: 3, done: 0 }, vs: { total: 3, done: 0 },
      git: { total: 6, done: 6 }, sec: { total: 5, done: 0 },
    }
    const recos = recommendNextCourses([devPath], comp, titles)
    expect(recos).toHaveLength(1)
    expect(recos[0].courseId).toBe('sec')
    expect(recos[0].reason).toContain('はじめてのGitとコマンド')
  })

  it('limit で件数を絞る', () => {
    const comp: CompletionMap = {
      term: { total: 1, done: 1 }, vs: { total: 1, done: 0 },
      git: { total: 1, done: 1 }, sec: { total: 1, done: 0 },
    }
    const recos = recommendNextCourses([devPath], comp, titles, 1)
    expect(recos.length).toBeLessThanOrEqual(1)
  })
})
