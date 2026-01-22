'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
  content: string
  truncate?: boolean
}

export function MarkdownRenderer({ content, truncate = false }: MarkdownRendererProps) {
  return (
    <div className={`markdown-content ${truncate ? 'truncated' : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="font-serif text-xl font-semibold mb-3" style={{ color: 'var(--color-accent-dark)' }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-serif text-lg font-semibold mb-2" style={{ color: 'var(--color-accent-dark)' }}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-serif text-base font-semibold mb-2" style={{ color: 'var(--color-accent-dark)' }}>
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-[15px] text-[var(--color-text)] leading-relaxed mb-3 last:mb-0">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 mb-3 text-[15px] text-[var(--color-text)]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 mb-3 text-[15px] text-[var(--color-text)]">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[var(--color-accent-secondary)] pl-4 my-3 text-[var(--color-muted)] italic">
              {children}
            </blockquote>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-[var(--color-accent-dark)]">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-[var(--color-muted)]">{children}</em>
          ),
          code: ({ children }) => (
            <code className="px-1.5 py-0.5 bg-[var(--color-accent)]/10 text-[var(--color-accent-dark)] rounded text-sm font-mono">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="p-3 bg-[var(--color-bg)] rounded-[var(--radius-sm)] overflow-x-auto mb-3 text-sm">
              {children}
            </pre>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-[var(--color-accent)] underline underline-offset-2 hover:text-[var(--color-accent-dark)]"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
