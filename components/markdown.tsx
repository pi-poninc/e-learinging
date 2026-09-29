import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Markdown を整形表示（GFM: 表・チェックリスト・打消し等に対応） */
export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div
      className={`prose prose-sm max-w-none prose-headings:mt-3 prose-headings:mb-2 prose-p:my-1.5 prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-code:text-pink-600 prose-code:before:content-[''] prose-code:after:content-[''] ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}
