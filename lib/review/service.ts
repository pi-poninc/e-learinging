/**
 * 提出×添削 のサーバー側ヘルパー。コース設定の取得（無ければ既定値）と、
 * 添削者がスタッフかどうかの判定。
 */
import { DEFAULT_TIMEZONE, DEFAULT_DAY_BOUNDARY_HOUR } from '@/lib/learning-day'

export interface EffectiveReviewSettings {
  dailyLimit: number
  slaHours: number
  weeklyGoalDays: number
  dayBoundaryHour: number
  timezone: string
  weekStart: 'monday' | 'sunday'
  reviewerDisplayMode: 'real_name' | 'nickname' | 'anonymous'
  submitEncouragement: string
  peerReviewMinGrade: number
  newReviewerCheckCount: number
}

export function defaultReviewSettings(): EffectiveReviewSettings {
  return {
    dailyLimit: 1,
    slaHours: 24,
    weeklyGoalDays: 7,
    dayBoundaryHour: DEFAULT_DAY_BOUNDARY_HOUR,
    timezone: DEFAULT_TIMEZONE,
    weekStart: 'monday',
    reviewerDisplayMode: 'nickname',
    submitEncouragement: '完璧でなくて大丈夫。今日の分を出すことが一番大事です。',
    peerReviewMinGrade: 3,
    newReviewerCheckCount: 10,
  }
}

// supabase はプロジェクトで型生成していないため any 相当で受ける（既存コードと同様）。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getReviewSettings(supabase: any, courseId: string): Promise<EffectiveReviewSettings> {
  const { data } = await supabase.from('review_settings').select('*').eq('course_id', courseId).maybeSingle()
  if (!data) return defaultReviewSettings()
  return {
    dailyLimit: data.daily_submission_limit,
    slaHours: data.sla_hours,
    weeklyGoalDays: data.weekly_goal_days,
    dayBoundaryHour: data.day_boundary_hour,
    timezone: data.timezone,
    weekStart: data.week_start,
    reviewerDisplayMode: data.reviewer_display_mode,
    submitEncouragement: data.submit_encouragement,
    peerReviewMinGrade: data.peer_review_min_grade ?? 3,
    newReviewerCheckCount: data.new_reviewer_check_count ?? 10,
  }
}

export const STAFF_ROLES = ['admin', 'instructor', 'manager']
export function isReviewer(role: string | null | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role)
}
