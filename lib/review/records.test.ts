import { describe, it, expect } from 'vitest'
import { toCsv } from './records'

describe('toCsv', () => {
  it('ヘッダと行を出力し、BOM付き・CRLF区切り', () => {
    const csv = toCsv(['a', 'b'], [[1, 'x'], [2, 'y']])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('a,b\r\n1,x\r\n2,y')
  })
  it('カンマ・引用符・改行を正しくエスケープ', () => {
    const csv = toCsv(['name', 'note'], [['山田, 太郎', 'a"b'], ['改行\nあり', 'ok']])
    expect(csv).toContain('"山田, 太郎","a""b"')
    expect(csv).toContain('"改行\nあり"')
  })
  it('null/空は空文字', () => {
    expect(toCsv(['x'], [[null]])).toContain('x\r\n')
  })
})
