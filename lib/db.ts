// Database types for the e-learning MVP
// These match the Supabase schema defined in migrations

export interface Profile {
  id: string
  name: string | null
  role: 'admin' | 'instructor' | 'student'
  created_at: string
  updated_at: string
}

export interface Course {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  status: 'draft' | 'published' | 'archived'
  is_sequential: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Section {
  id: string
  course_id: string
  title: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Lesson {
  id: string
  section_id: string
  title: string
  body: string | null
  vimeo_url: string | null
  vimeo_video_id: string | null
  duration_seconds: number | null
  sort_order: number
  is_preview: boolean
  status: 'draft' | 'published' | 'archived'
  created_at: string
  updated_at: string
}

export interface Enrollment {
  id: string
  user_id: string
  course_id: string
  status: 'active' | 'suspended' | 'completed'
  enrolled_at: string
}

export interface LessonProgress {
  id: string
  user_id: string
  lesson_id: string
  watched_seconds: number
  progress_rate: number
  completed: boolean
  completed_at: string | null
  updated_at: string
}

// ============================================
// Quiz types
// ============================================

export type QuestionType = 'single_choice' | 'multiple_choice' | 'true_false' | 'ordering'

export interface Quiz {
  id: string
  section_id: string
  title: string
  description: string | null
  passing_score: number
  sort_order: number
  time_limit_minutes: number | null
  status: 'draft' | 'published' | 'archived'
  created_at: string
  updated_at: string
}

export interface QuizQuestion {
  id: string
  quiz_id: string
  question_type: QuestionType
  question_text: string
  explanation: string | null
  sort_order: number
  points: number
  created_at: string
  updated_at: string
}

export interface QuizOption {
  id: string
  question_id: string
  option_text: string
  is_correct: boolean
  correct_position: number | null
  sort_order: number
  created_at: string
}

export interface QuizAttempt {
  id: string
  user_id: string
  quiz_id: string
  score: number
  total_points: number
  earned_points: number
  passed: boolean
  started_at: string
  completed_at: string | null
}

export interface QuizAnswer {
  id: string
  attempt_id: string
  question_id: string
  selected_option_ids: string[]
  ordering_result: string[]
  is_correct: boolean
  points_earned: number
  created_at: string
}

// ============================================
// Assignment types
// ============================================

export interface Assignment {
  id: string
  section_id: string
  title: string
  description: string | null
  sort_order: number
  max_file_size_mb: number
  allowed_file_types: string[]
  status: 'draft' | 'published' | 'archived'
  created_at: string
  updated_at: string
}

export interface AssignmentSubmission {
  id: string
  user_id: string
  assignment_id: string
  file_url: string
  file_name: string
  file_size_bytes: number | null
  comment: string | null
  status: 'submitted' | 'reviewed' | 'approved' | 'rejected'
  grade: number | null
  feedback: string | null
  submitted_at: string
  reviewed_at: string | null
}

// ============================================
// Certificate types
// ============================================

export interface Certificate {
  id: string
  user_id: string
  course_id: string
  certificate_number: string
  issued_at: string
  pdf_url: string | null
}

// ============================================
// Case simulation types (案件シミュレーター)
// ============================================

// 1局面（意思決定ポイント）
export interface CaseScene {
  ch: string            // 例: "局面 01"
  title: string
  lead: string
  thread: { role: string; ts: string; text: string }[]
  ask: string
  sub?: string
  options: { text: string; actual?: boolean }[]
  verdictHit: string
  verdictMiss: string
  did: string
  learn: string
}

// 分岐シナリオ全体（case_simulations.scenario に jsonb で格納）
export interface CaseScenario {
  intro: {
    kicker: string
    heading: string
    paragraphs: string[]
    facts: { l: string; v: string }[]
    note?: string
  }
  roles: Record<string, { name: string; role: string; tag: string; color: string }>
  scenes: CaseScene[]
  recap: { t: string; d: string }[]
  next?: { label: string; title: string; desc: string }
}

export interface CaseSimulation {
  id: string
  section_id: string
  title: string
  description: string | null
  scenario: CaseScenario
  sort_order: number
  status: 'draft' | 'published' | 'archived'
  created_at: string
  updated_at: string
}

export interface CaseAttempt {
  id: string
  user_id: string
  case_simulation_id: string
  completed: boolean
  path_taken: number[]
  score: number
  total: number
  completed_at: string | null
  updated_at: string
}

// ============================================
// Course item (unified type for navigation)
// ============================================

export type CourseItemType = 'lesson' | 'quiz' | 'assignment' | 'case'

export interface CourseItem {
  id: string
  type: CourseItemType
  title: string
  sort_order: number
  section_id: string
  status: string
  completed: boolean
  locked: boolean
}
