'use client'

import type { QuestionType } from '@/lib/db'

interface Option {
  id: string
  option_text: string
}

interface QuizQuestionProps {
  questionIndex: number
  questionText: string
  questionType: QuestionType
  options: Option[]
  selectedOptionIds: string[]
  orderingResult: string[]
  onSelectOption: (optionId: string) => void
  onSetOrdering: (orderedIds: string[]) => void
  disabled?: boolean
}

export function QuizQuestionComponent({
  questionIndex,
  questionText,
  questionType,
  options,
  selectedOptionIds,
  orderingResult,
  onSelectOption,
  onSetOrdering,
  disabled,
}: QuizQuestionProps) {
  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...orderingResult]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newOrder.length) return
    ;[newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]]
    onSetOrdering(newOrder)
  }

  return (
    <div className="mb-6">
      <p className="text-sm font-medium text-gray-900 mb-3">
        <span className="text-blue-600 mr-2">Q{questionIndex + 1}.</span>
        {questionText}
      </p>

      {questionType === 'ordering' ? (
        <div className="space-y-2">
          {orderingResult.map((optionId, idx) => {
            const option = options.find((o) => o.id === optionId)
            if (!option) return null
            return (
              <div key={optionId} className="flex items-center gap-2 bg-gray-50 rounded-md p-3 border border-gray-200">
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    disabled={disabled || idx === 0}
                    onClick={() => moveItem(idx, 'up')}
                    className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs leading-none"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={disabled || idx === orderingResult.length - 1}
                    onClick={() => moveItem(idx, 'down')}
                    className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs leading-none"
                  >
                    ▼
                  </button>
                </div>
                <span className="text-sm text-gray-500 w-6">{idx + 1}.</span>
                <span className="text-sm text-gray-900">{option.option_text}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {options.map((option) => {
            const isSelected = selectedOptionIds.includes(option.id)
            const inputType = questionType === 'multiple_choice' ? 'checkbox' : 'radio'

            return (
              <label
                key={option.id}
                className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <input
                  type={inputType}
                  checked={isSelected}
                  disabled={disabled}
                  onChange={() => onSelectOption(option.id)}
                  className="accent-blue-600"
                />
                <span className="text-sm text-gray-900">{option.option_text}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
