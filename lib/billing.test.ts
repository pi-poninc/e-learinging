import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import { formatPriceJpy, isPaid, verifyWebhookSignature } from './billing'

describe('formatPriceJpy', () => {
  it('正の価格は ¥ とカンマ区切り', () => {
    expect(formatPriceJpy(1980)).toBe('¥1,980')
    expect(formatPriceJpy(500000)).toBe('¥500,000')
  })
  it('0 / null / undefined は無料', () => {
    expect(formatPriceJpy(0)).toBe('無料')
    expect(formatPriceJpy(null)).toBe('無料')
    expect(formatPriceJpy(undefined)).toBe('無料')
  })
})

describe('isPaid', () => {
  it('正の数のみ有料', () => {
    expect(isPaid(100)).toBe(true)
    expect(isPaid(0)).toBe(false)
    expect(isPaid(null)).toBe(false)
    expect(isPaid(-5)).toBe(false)
  })
})

describe('verifyWebhookSignature', () => {
  const secret = 'whsec_test123'
  const body = '{"type":"checkout.session.completed"}'
  const now = 1_700_000_000
  const sign = (t: number, payload: string, sec: string) =>
    crypto.createHmac('sha256', sec).update(`${t}.${payload}`, 'utf8').digest('hex')

  it('正しい署名を検証できる', () => {
    const header = `t=${now},v1=${sign(now, body, secret)}`
    expect(verifyWebhookSignature(body, header, secret, 300, now)).toBe(true)
  })
  it('改ざんされた本文は拒否', () => {
    const header = `t=${now},v1=${sign(now, body, secret)}`
    expect(verifyWebhookSignature(body + 'x', header, secret, 300, now)).toBe(false)
  })
  it('誤ったシークレットは拒否', () => {
    const header = `t=${now},v1=${sign(now, body, 'wrong')}`
    expect(verifyWebhookSignature(body, header, secret, 300, now)).toBe(false)
  })
  it('許容時間を超えた古い署名は拒否', () => {
    const old = now - 1000
    const header = `t=${old},v1=${sign(old, body, secret)}`
    expect(verifyWebhookSignature(body, header, secret, 300, now)).toBe(false)
  })
  it('secret/header 欠如は拒否', () => {
    expect(verifyWebhookSignature(body, null, secret, 300, now)).toBe(false)
    expect(verifyWebhookSignature(body, `t=${now},v1=abc`, undefined, 300, now)).toBe(false)
  })
})
