'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AdminLayout } from '@/components/layouts/admin-layout'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface QuizData {
  id: string
  title: string
  description: string | null
  passing_score: number
  sort_order: number
  time_limit_minutes: number | null
  status: string
  section: { course_id: string }
}

interface OptionData {
  id: string
  option_text: string
  is_correct: boolean
  correct_position: number | null
  sort_order: number
}

interface QuestionData {
  id: string
  question_type: string
  question_text: string
  explanation: string | null
  sort_order: number
  points: number
  options: OptionData[]
}

export default function EditQuizPage() {
  const router = useRouter()
  const params = useParams()
  const quizId = params.quizId as string
  const supabase = useMemo(() => createClient(), [])

  const [quiz, setQuiz] = useState<QuizData | null>(null)
  const [questions, setQuestions] = useState<QuestionData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    const { data: quizData } = await supabase
      .from('quizzes')
      .select('*, section:sections(course_id)')
      .eq('id', quizId)
      .single()

    if (quizData) setQuiz(quizData as unknown as QuizData)

    const { data: questionsData } = await supabase
      .from('quiz_questions')
      .select('*, options:quiz_options(*)')
      .eq('quiz_id', quizId)
      .order('sort_order')

    if (questionsData) {
      setQuestions(questionsData.map((q) => ({
        ...q,
        options: ((q.options || []) as OptionData[]).sort((a, b) => a.sort_order - b.sort_order),
      })) as QuestionData[])
    }

    setLoading(false)
  }, [quizId, supabase])

  useEffect(() => { loadData() }, [loadData])

  const handleSaveQuiz = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const fd = new FormData(e.currentTarget)

    const { error: err } = await supabase.from('quizzes').update({
      title: fd.get('title') as string,
      description: (fd.get('description') as string) || null,
      passing_score: parseInt(fd.get('passing_score') as string) || 80,
      sort_order: parseInt(fd.get('sort_order') as string) || 0,
      time_limit_minutes: parseInt(fd.get('time_limit_minutes') as string) || null,
      status: fd.get('status') as string,
    }).eq('id', quizId)

    if (err) setError(err.message)
    setSaving(false)
  }

  const handleAddQuestion = async (type: string) => {
    const maxOrder = questions.reduce((max, q) => Math.max(max, q.sort_order), -1)
    const { data } = await supabase.from('quiz_questions').insert({
      quiz_id: quizId,
      question_type: type,
      question_text: '新しい問題',
      sort_order: maxOrder + 1,
    }).select().single()

    if (data) {
      // Add default options
      if (type === 'true_false') {
        await supabase.from('quiz_options').insert([
          { question_id: data.id, option_text: '○', is_correct: true, sort_order: 0 },
          { question_id: data.id, option_text: '×', is_correct: false, sort_order: 1 },
        ])
      } else {
        await supabase.from('quiz_options').insert([
          { question_id: data.id, option_text: '選択肢1', is_correct: true, sort_order: 0, correct_position: type === 'ordering' ? 1 : null },
          { question_id: data.id, option_text: '選択肢2', is_correct: false, sort_order: 1, correct_position: type === 'ordering' ? 2 : null },
        ])
      }
      loadData()
    }
  }

  const handleSaveQuestion = async (question: QuestionData) => {
    await supabase.from('quiz_questions').update({
      question_text: question.question_text,
      explanation: question.explanation,
      points: question.points,
      sort_order: question.sort_order,
    }).eq('id', question.id)

    // Update options
    for (const opt of question.options) {
      await supabase.from('quiz_options').update({
        option_text: opt.option_text,
        is_correct: opt.is_correct,
        correct_position: opt.correct_position,
        sort_order: opt.sort_order,
      }).eq('id', opt.id)
    }
  }

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('この問題を削除しますか？')) return
    await supabase.from('quiz_questions').delete().eq('id', questionId)
    loadData()
  }

  const handleAddOption = async (questionId: string) => {
    const question = questions.find((q) => q.id === questionId)
    const maxOrder = question ? question.options.reduce((max, o) => Math.max(max, o.sort_order), -1) : -1

    await supabase.from('quiz_options').insert({
      question_id: questionId,
      option_text: '新しい選択肢',
      sort_order: maxOrder + 1,
    })
    loadData()
  }

  const handleDeleteOption = async (optionId: string) => {
    await supabase.from('quiz_options').delete().eq('id', optionId)
    loadData()
  }

  const updateQuestionLocal = (questionId: string, field: string, value: string | number | null) => {
    setQuestions((prev) => prev.map((q) =>
      q.id === questionId ? { ...q, [field]: value } : q
    ))
  }

  const updateOptionLocal = (questionId: string, optionId: string, field: string, value: string | boolean | number | null) => {
    setQuestions((prev) => prev.map((q) =>
      q.id === questionId
        ? { ...q, options: q.options.map((o) => o.id === optionId ? { ...o, [field]: value } : o) }
        : q
    ))
  }

  const typeLabels: Record<string, string> = {
    single_choice: '単一選択',
    multiple_choice: '複数選択',
    true_false: '○×',
    ordering: '並び替え',
  }

  if (loading) return <AdminLayout><p className="text-gray-500">読み込み中...</p></AdminLayout>
  if (!quiz) return <AdminLayout><p className="text-red-600">クイズが見つかりません。</p></AdminLayout>

  return (
    <AdminLayout>
      <div className="mb-4">
        <Link href={`/admin/courses/${quiz.section.course_id}/edit`} className="text-sm text-blue-600 hover:text-blue-700">
          &larr; 講座編集に戻る
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">クイズを編集</h1>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">{error}</div>}

      {/* Quiz info */}
      <Card className="mb-8 max-w-2xl">
        <CardHeader><h2 className="text-lg font-semibold">基本情報</h2></CardHeader>
        <CardBody>
          <form onSubmit={handleSaveQuiz} className="space-y-4">
            <Input label="タイトル" name="title" required defaultValue={quiz.title} />
            <Textarea label="説明" name="description" defaultValue={quiz.description || ''} />
            <Input label="合格ライン（%）" name="passing_score" type="number" defaultValue={quiz.passing_score} />
            <Input label="制限時間（分）" name="time_limit_minutes" type="number" defaultValue={quiz.time_limit_minutes || ''} placeholder="未設定で無制限" />
            <Input label="並び順" name="sort_order" type="number" defaultValue={quiz.sort_order} />
            <Select label="ステータス" name="status" defaultValue={quiz.status} options={[
              { value: 'draft', label: '下書き' },
              { value: 'published', label: '公開' },
              { value: 'archived', label: 'アーカイブ' },
            ]} />
            <Button type="submit" loading={saving}>保存</Button>
          </form>
        </CardBody>
      </Card>

      {/* Questions */}
      <h2 className="text-xl font-bold text-gray-900 mb-4">問題</h2>

      <div className="space-y-4 mb-6">
        {questions.map((q, qIdx) => (
          <Card key={q.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Q{qIdx + 1} [{typeLabels[q.question_type]}] - {q.points}pt
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => handleSaveQuestion(q)}>保存</Button>
                  <Button variant="danger" size="sm" onClick={() => handleDeleteQuestion(q.id)}>削除</Button>
                </div>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                <Textarea
                  label="問題文"
                  value={q.question_text}
                  onChange={(e) => updateQuestionLocal(q.id, 'question_text', e.target.value)}
                  rows={2}
                />
                <Input
                  label="解説（回答後に表示）"
                  value={q.explanation || ''}
                  onChange={(e) => updateQuestionLocal(q.id, 'explanation', e.target.value)}
                />
                <Input
                  label="配点"
                  type="number"
                  value={q.points}
                  onChange={(e) => updateQuestionLocal(q.id, 'points', parseInt(e.target.value) || 1)}
                />

                {/* Options */}
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">選択肢</p>
                  {q.options.map((opt, oIdx) => (
                    <div key={opt.id} className="flex items-center gap-2 mb-2">
                      <Input
                        value={opt.option_text}
                        onChange={(e) => updateOptionLocal(q.id, opt.id, 'option_text', e.target.value)}
                        className="flex-1"
                      />
                      {q.question_type === 'ordering' ? (
                        <Input
                          type="number"
                          value={opt.correct_position || oIdx + 1}
                          onChange={(e) => updateOptionLocal(q.id, opt.id, 'correct_position', parseInt(e.target.value))}
                          className="w-16"
                          placeholder="順番"
                        />
                      ) : (
                        <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                          <input
                            type={q.question_type === 'multiple_choice' ? 'checkbox' : 'radio'}
                            name={`correct-${q.id}`}
                            checked={opt.is_correct}
                            onChange={() => {
                              if (q.question_type === 'multiple_choice') {
                                updateOptionLocal(q.id, opt.id, 'is_correct', !opt.is_correct)
                              } else {
                                q.options.forEach((o) => updateOptionLocal(q.id, o.id, 'is_correct', o.id === opt.id))
                              }
                            }}
                          />
                          正解
                        </label>
                      )}
                      <button onClick={() => handleDeleteOption(opt.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                    </div>
                  ))}
                  {q.question_type !== 'true_false' && (
                    <Button variant="ghost" size="sm" onClick={() => handleAddOption(q.id)}>+ 選択肢追加</Button>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Add question buttons */}
      <Card>
        <CardBody>
          <p className="text-sm font-medium text-gray-700 mb-3">問題を追加</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => handleAddQuestion('single_choice')}>単一選択</Button>
            <Button variant="secondary" size="sm" onClick={() => handleAddQuestion('multiple_choice')}>複数選択</Button>
            <Button variant="secondary" size="sm" onClick={() => handleAddQuestion('true_false')}>○×</Button>
            <Button variant="secondary" size="sm" onClick={() => handleAddQuestion('ordering')}>並び替え</Button>
          </div>
        </CardBody>
      </Card>
    </AdminLayout>
  )
}
