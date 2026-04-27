'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'

interface FileUploadProps {
  assignmentId: string
  allowedTypes: string[]
  maxSizeMb: number
  onUploaded: () => void
}

export function FileUpload({ assignmentId, allowedTypes, maxSizeMb, onUploaded }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [comment, setComment] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (allowedTypes.length > 0 && ext && !allowedTypes.includes(ext)) {
      setError(`許可されていないファイル形式です (${allowedTypes.join(', ')})`)
      return
    }
    if (f.size > maxSizeMb * 1024 * 1024) {
      setError(`ファイルサイズが上限(${maxSizeMb}MB)を超えています`)
      return
    }
    setError('')
    setFile(f)
  }

  const handleSubmit = async () => {
    if (!file) return
    setUploading(true)
    setError('')

    const formData = new FormData()
    formData.append('assignmentId', assignmentId)
    formData.append('file', file)
    if (comment) formData.append('comment', comment)

    try {
      const res = await fetch('/api/assignments/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'アップロードに失敗しました')
        setUploading(false)
        return
      }

      setFile(null)
      setComment('')
      onUploaded()
    } catch {
      setError('ネットワークエラーが発生しました')
    }
    setUploading(false)
  }

  return (
    <div>
      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">{error}</div>
      )}

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]) }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={allowedTypes.map((t) => `.${t}`).join(',')}
          onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
        />
        {file ? (
          <div>
            <p className="text-sm font-medium text-gray-900">{file.name}</p>
            <p className="text-xs text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600">ファイルをドラッグ&ドロップ、またはクリックして選択</p>
            <p className="text-xs text-gray-400 mt-1">
              対応形式: {allowedTypes.join(', ')} / 最大 {maxSizeMb}MB
            </p>
          </div>
        )}
      </div>

      {file && (
        <div className="mt-4 space-y-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="コメント（任意）"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            rows={3}
          />
          <Button onClick={handleSubmit} loading={uploading}>提出する</Button>
        </div>
      )}
    </div>
  )
}
