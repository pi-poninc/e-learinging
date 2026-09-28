'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import Player from '@vimeo/player'
import { extractVimeoId } from '@/lib/vimeo'
import { Button } from '@/components/ui/button'

interface VimeoPlayerProps {
  lessonId: string
  vimeoUrl: string
  vimeoVideoId: string
  initialWatchedSeconds: number
  initialProgressRate: number
}

export function VimeoPlayerWrapper({
  lessonId,
  vimeoUrl,
  vimeoVideoId,
  initialWatchedSeconds,
  initialProgressRate,
}: VimeoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)
  const lastSaveRef = useRef<number>(0)
  const [completed, setCompleted] = useState(initialProgressRate >= 0.9)
  const [completing, setCompleting] = useState(false)

  const videoId = vimeoVideoId || extractVimeoId(vimeoUrl)

  const saveProgress = useCallback(
    async (watchedSeconds: number, progressRate: number) => {
      const now = Date.now()
      // Throttle saves to every 10 seconds
      if (now - lastSaveRef.current < 10000) return
      lastSaveRef.current = now

      try {
        await fetch('/api/lesson-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lessonId,
            watchedSeconds: Math.floor(watchedSeconds),
            progressRate: Math.min(progressRate, 1),
          }),
        })

        if (progressRate >= 0.9) {
          setCompleted(true)
        }
      } catch {
        // Silent fail for progress saving
      }
    },
    [lessonId]
  )

  const markComplete = useCallback(async () => {
    setCompleting(true)
    try {
      await fetch('/api/lesson-progress/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId }),
      })
      setCompleted(true)
    } catch {
      // Silent fail
    } finally {
      setCompleting(false)
    }
  }, [lessonId])

  useEffect(() => {
    if (!containerRef.current || !videoId) return

    // 限定公開(unlisted)動画は URL のハッシュ(?h=...)が必要なので、vimeoUrl があれば
    // フルURLで初期化する（id だけだと privacy エラーで再生できない）。公開動画でもURL初期化で問題ない。
    type PlayerOptions = ConstructorParameters<typeof Player>[1]
    const player = vimeoUrl
      ? new Player(containerRef.current, { url: vimeoUrl, width: 960, responsive: true } as PlayerOptions)
      : new Player(containerRef.current, { id: parseInt(videoId, 10), width: 960, responsive: true })

    playerRef.current = player

    // Resume from last position
    if (initialWatchedSeconds > 0) {
      player.setCurrentTime(initialWatchedSeconds).catch(() => {})
    }

    // Track progress on timeupdate
    player.on('timeupdate', (data) => {
      saveProgress(data.seconds, data.percent)
    })

    // Mark complete on ended
    player.on('ended', () => {
      markComplete()
    })

    return () => {
      player.destroy()
    }
  }, [videoId, vimeoUrl, initialWatchedSeconds, saveProgress, markComplete])

  if (!videoId) {
    return (
      <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">有効なVimeo URLが設定されていません。</p>
      </div>
    )
  }

  return (
    <div>
      <div
        ref={containerRef}
        className="aspect-video bg-black rounded-lg overflow-hidden"
      />
      <div className="mt-3 flex items-center justify-between">
        {completed ? (
          <span className="text-sm font-medium text-green-600">完了済み</span>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={markComplete}
            loading={completing}
          >
            レッスンを完了にする
          </Button>
        )}
      </div>
    </div>
  )
}
