import { describe, it, expect } from 'vitest'
import { buildReminderMessage, type ReminderTarget } from './reminders'

const base: ReminderTarget = {
  enrollmentId: 'e1', email: 'u@example.com', name: '山田',
  courseTitle: 'ターミナル入門', dueDate: '2026-10-20', overdue: false, source: 'course',
}

describe('buildReminderMessage', () => {
  it('期限が近い場合は催促トーンの件名', () => {
    const { subject, text } = buildReminderMessage(base, 'https://app.example.com')
    expect(subject).toContain('受講期限が近づいています')
    expect(subject).toContain('ターミナル入門')
    expect(text).toContain('山田 さん')
    expect(text).toContain('2026-10-20')
    expect(text).toContain('もうすぐ期限です')
    expect(text).toContain('https://app.example.com/dashboard')
  })

  it('期限切れの場合は期限切れ件名と本文', () => {
    const { subject, text } = buildReminderMessage({ ...base, overdue: true }, 'https://app.example.com')
    expect(subject).toContain('受講期限切れ')
    expect(text).toContain('期限を過ぎています')
  })

  it('appUrl が空でも dashboard リンクを含む', () => {
    const { text } = buildReminderMessage(base, '')
    expect(text).toContain('/dashboard')
  })
})
