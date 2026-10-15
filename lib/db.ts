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

// 情報カード（ブリーフィングで提示する事前情報のまとまり）
export interface CaseInfoCard {
  label: string         // 例: "背景" / "関係者" / "制約・前提" / "いま分かっていること" / "論点"
  items: string[]
}

// 1局面（意思決定ポイント）
export interface CaseScene {
  ch: string            // 例: "局面 01"
  title: string
  lead: string
  // --- ブリーフィング（判断の前に与える事前情報。すべて任意・後方互換） ---
  situation?: string[]  // より詳しい状況説明（段落）
  brief?: CaseInfoCard[] // 背景・関係者・制約・論点などの情報カード
  // --- 現場ログ ---
  thread: { role: string; ts: string; text: string }[]
  // --- 意思決定 ---
  ask: string
  sub?: string
  options: { text: string; actual?: boolean }[]
  // --- 答え合わせ ---
  verdictHit: string
  verdictMiss: string
  did: string
  outcome?: string      // その後どうなったか（任意）
  learn: string
}

// 分岐シナリオ全体（case_simulations.scenario に jsonb で格納）
export interface CaseScenario {
  intro: {
    kicker: string
    heading: string
    paragraphs: string[]
    facts: { l: string; v: string }[]
    dossier?: CaseInfoCard[]  // 案件全体のブリーフィング（体制・制約・経緯など・任意）
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
// Learning path types（学習ロードマップ）
// ============================================

export interface LearningPath {
  id: string
  title: string
  description: string | null
  status: 'draft' | 'published' | 'archived'
  sort_order: number
  created_at: string
  updated_at: string
}

export interface PathItem {
  id: string
  path_id: string
  course_id: string
  sort_order: number
  target_days: number | null
  milestone_label: string | null
  created_at: string
}

export interface PathEnrollment {
  id: string
  user_id: string
  path_id: string
  started_at: string
  status: 'active' | 'completed'
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

// ===== 提出 × 添削 機能（Phase 1）=====
export interface ReviewSettings {
  course_id: string
  daily_submission_limit: number
  sla_hours: number
  weekly_goal_days: number
  day_boundary_hour: number
  timezone: string
  week_start: 'sunday' | 'monday'
  early_threshold_submissions: number
  early_window_days: number
  ai_draft_enabled: boolean
  reviewer_display_mode: 'real_name' | 'nickname' | 'anonymous'
  submit_encouragement: string
  created_at: string
  updated_at: string
}

export interface ReviewerProfile {
  user_id: string
  display_name: string
  avatar_url: string | null
  course_ids: string[]
  max_concurrent_claims: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ReviewTaskStep {
  title: string
  description?: string
  video_url?: string
}

export type ReviewSubmissionType = 'text' | 'url' | 'file' | 'audio' | 'video' | 'code_repo'

export interface ReviewTask {
  id: string
  course_id: string
  lesson_id: string | null
  title: string
  instructions: string | null
  steps: ReviewTaskStep[]
  submission_types: ReviewSubmissionType[]
  pre_submit_checklist: string[]
  estimated_minutes: number | null
  order_index: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ReviewSubmissionStatus =
  | 'draft' | 'submitted' | 'in_review' | 'reviewed' | 'returned_for_resubmission'

export interface ReviewAttachment {
  path: string
  name: string
  size: number
  mime: string
}

export interface ReviewSubmission {
  id: string
  task_id: string
  course_id: string
  user_id: string
  status: ReviewSubmissionStatus
  content_text: string | null
  content_url: string | null
  attachments: ReviewAttachment[]
  learning_day: string | null
  submitted_at: string | null
  sla_due_at: string | null
  submission_number: number | null
  auto_check_result: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type ReviewFeedbackStatus = 'claimed' | 'drafting' | 'published'

export interface ReviewFeedback {
  id: string
  submission_id: string
  reviewer_id: string
  status: ReviewFeedbackStatus
  good_points: string | null
  improvements: string | null
  next_action: string | null
  inline_comments: unknown[]
  rubric_scores: Record<string, unknown>
  ai_draft: Record<string, unknown> | null
  claimed_at: string
  published_at: string | null
  review_duration_seconds: number | null
  created_at: string
  updated_at: string
}

// ===== 育成プログラム Phase A（スキルマップ＆グレード）=====
export interface SkillMap { id: string; course_id: string; name: string; version: number; is_active: boolean; created_at: string }
export interface Skill { id: string; skill_map_id: string; category: string; name: string; description: string | null; order_index: number }
export interface SkillLevelDef { id: string; skill_id: string; level: number; behavior_description: string | null }
export interface Rubric { id: string; course_id: string; name: string; is_active: boolean; created_at: string }
export interface RubricItem { id: string; rubric_id: string; label: string; skill_id: string | null; weight: number; max_level: number; order_index: number }
export interface SkillAssessment {
  id: string; user_id: string; skill_id: string
  source_type: 'review' | 'peer_review' | 'case_assignment' | 'demo_day' | 'manual'
  source_id: string | null; level_observed: number; assessed_by: string | null; assessed_at: string
}
export interface UserSkillLevel { user_id: string; skill_id: string; current_level: number; confidence: 'low' | 'medium' | 'high'; updated_at: string }
export interface Grade { id: string; course_id: string; level: number; name: string; requirements: Record<string, number>; order_index: number }
export interface UserGrade {
  id: string; user_id: string; grade_id: string
  status: 'eligible' | 'approved' | 'rejected'
  evidence: Record<string, unknown>; approved_by: string | null; approved_at: string | null; created_at: string
}
export interface LearningEvent { id: string; user_id: string; course_id: string | null; event_name: string; properties: Record<string, unknown>; occurred_at: string }
