import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownMessageProps {
  content: string
}

function isExternalLink(href?: string) {
  return href?.startsWith('https://') || href?.startsWith('http://')
}

export default function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="markdown-message">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => href ? (
              <a
                href={href}
                {...(isExternalLink(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {children}
              </a>
            ) : <span>{children}</span>,
          img: () => null,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
