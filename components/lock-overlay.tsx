interface LockOverlayProps {
  locked: boolean
  children: React.ReactNode
}

export function LockOverlay({ locked, children }: LockOverlayProps) {
  if (!locked) return <>{children}</>

  return (
    <div className="relative">
      <div className="opacity-50 pointer-events-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-gray-800/70 text-white rounded-full px-3 py-1 text-xs flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          前のコンテンツを完了してください
        </div>
      </div>
    </div>
  )
}
