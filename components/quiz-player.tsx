'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { QuizQuestionComponent } from '@/components/quiz-question'
import type { QuestionType } from '@/lib/db'

interface QuizOption {
  id: string
  option_text: string
  sort_order: number
}

interface QuizQuestionData {
  id: string
  question_type: QuestionType
  question_text: string
  explanation: string | null
  sort_order: number
  points: number
  options: QuizOption[]
}

interface QuizPlayerProps {
  quizId: string
  quizTitle: string
  passingScore: number
  timeLimitMinutes: number | null
  questions: QuizQuestionData[]
  alreadyPassed: boolean
}

interface GradedAnswer {
  question_id: string
  is_correct: boolean
  points_earned: number
}

interface SubmitResult {
  score: number
  totalPoints: number
  earnedPoints: number
  passed: boolean
  passingScore: number
  answers: GradedAnswer[]
}

export function QuizPlayer({
  quizId,
  quizTitle,
  passingScore,
  questions,
  alreadyPassed,
}: QuizPlayerProps) {
  const [answers, setAnswers] = useState<Map<string, { selectedOptionIds: string[]; orderingResult: string[] }>>(
    () => {
      const map = new Map()
      for (const q of questions) {
        if (q.question_type === 'ordering') {
          map.set(q.id, { selectedOptionIds: [], orderingResult: q.options.map((o) => o.id) })
        } else {
          map.set(q.id, { selectedOptionIds: [], orderingResult: [] })
        }
      }
      return map
    }
  )
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [error, setError] = useState('')

  const handleSelectOption = (questionId: string, optionId: string, questionType: QuestionType) => {
    setAnswers((prev) => {
      const next = new Map(prev)
      const current = next.get(questionId) || { selectedOptionIds: [], orderingResult: [] }

      if (questionType === 'multiple_choice') {
        const ids = current.selectedOptionIds.includes(optionId)
          ? current.selectedOptionIds.filter((id) => id !== optionId)
          : [...current.selectedOptionIds, optionId]
        next.set(questionId, { ...current, selectedOptionIds: ids })
      } else {
        next.set(questionId, { ...current, selectedOptionIds: [optionId] })
      }
      return next
    })
  }

  const handleSetOrdering = (questionId: string, orderedIds: string[]) => {
    setAnswers((prev) => {
      const next = new Map(prev)
      const current = next.get(questionId) || { selectedOptionIds: [], orderingResult: [] }
      next.set(questionId, { ...current, orderingResult: orderedIds })
      return next
    })
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')

    const payload = {
      quizId,
      answers: questions.map((q) => {
        const ans = answers.get(q.id)
        return {
          questionId: q.id,
          selectedOptionIds: ans?.selectedOptionIds || [],
          orderingResult: ans?.orderingResult || [],
        }
      }),
    }

    try {
      const res = await fetch('/api/quizzes/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'エラーが発生しました')
        setSubmitting(false)
        return
      }

      const data = await res.json()
      setResult(data)
    } catch {
      setError('ネットワークエラーが発生しました')
    }
    setSubmitting(false)
  }

  // Show results
  if (result) {
    return (
      <div>
        <Card className="mb-6">
          <CardBody className="text-center py-8">
            <h2 className="text-2xl font-bold mb-2">
              {result.passed ? '合格！' : '不合格'}
            </h2>
            <p className="text-4xl font-bold mb-4" style={{ color: result.passed ? '#16a34a' : '#dc2626' }}>
              {result.score}点
            </p>
            <p className="text-gray-500">
              合格ライン: {result.passingScore}点 / 獲得: {result.earnedPoints}/{result.totalPoints}ポイント
            </p>
          </CardBody>
        </Card>

        {/* Per-question results */}
        <div className="space-y-4">
          {questions.map((q, idx) => {
            const graded = result.answers.find((a) => a.question_id === q.id)
            return (
              <Card key={q.id}>
                <CardBody>
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-medium">
                      <span className="text-blue-600 mr-2">Q{idx + 1}.</span>
                      {q.question_text}
                    </p>
                    <Badge variant={graded?.is_correct ? 'success' : 'danger'}>
                      {graded?.is_correct ? '正解' : '不正解'}
                    </Badge>
                  </div>
                  {q.explanation && (
                    <p className="text-sm text-gray-600 mt-2 p-2 bg-gray-50 rounded">
                      {q.explanation}
                    </p>
                  )}
                </CardBody>
              </Card>
            )
          })}
        </div>

        {!result.passed && (
          <div className="mt-6 text-center">
            <Button onClick={() => { setResult(null); setError('') }}>
              もう一度受験する
            </Button>
          </div>
        )}
      </div>
    )
  }

  // Already passed
  if (alreadyPassed) {
    return (
      <Card>
        <CardBody className="text-center py-8">
          <Badge variant="success" >合格済み</Badge>
          <h2 className="text-xl font-bold mt-4">{quizTitle}</h2>
          <p className="text-gray-500 mt-2">このテストは合格済みです。</p>
        </CardBody>
      </Card>
    )
  }

  // Quiz form
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">{quizTitle}</h2>
        <p className="text-sm text-gray-500 mt-1">
          合格ライン: {passingScore}点 / {questions.length}問
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {error}
        </div>
      )}

      {questions.map((q, idx) => {
        const ans = answers.get(q.id)
        return (
          <QuizQuestionComponent
            key={q.id}
            questionIndex={idx}
            questionText={q.question_text}
            questionType={q.question_type}
            options={q.options}
            selectedOptionIds={ans?.selectedOptionIds || []}
            orderingResult={ans?.orderingResult || []}
            onSelectOption={(optionId) => handleSelectOption(q.id, optionId, q.question_type)}
            onSetOrdering={(orderedIds) => handleSetOrdering(q.id, orderedIds)}
          />
        )
      })}

      <Button onClick={handleSubmit} loading={submitting} className="w-full">
        回答を提出する
      </Button>
    </div>
  )
}
