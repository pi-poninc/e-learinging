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
