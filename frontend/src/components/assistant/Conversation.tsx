import { Bot, UserRound } from 'lucide-react'
import AccountAvatar from '@/components/account/AccountAvatar'
import type { LocalAccount } from '@/profile/types'
import type { AssistantResponse } from '@/services/assistantClient'
import NeedClarifier from './NeedClarifier'
import ResourceRecommendation from './ResourceRecommendation'
import MarkdownMessage from './MarkdownMessage'

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  response?: AssistantResponse
}

interface ConversationProps {
  account?: LocalAccount | null
  messages: ConversationMessage[]
  loading: boolean
  error?: string
  onClarify: (value: string) => void
  onRetry: () => void
}

export default function Conversation({ account, messages, loading, error, onClarify, onRetry }: ConversationProps) {
  return (
    <div className="conversation" aria-live="polite">
      {messages.map((message) => (
        <article key={message.id} className={`message message--${message.role}`}>
          <div className="message__avatar" aria-hidden={message.role === 'assistant' || !account ? 'true' : undefined}>
            {message.role === 'assistant' ? <Bot size={18} /> : account ? <AccountAvatar account={account} /> : <UserRound size={18} />}
          </div>
          <div className="message__body">
            <span>{message.role === 'assistant' ? '导航助手' : '我'}</span>
            {message.role === 'assistant'
              ? <MarkdownMessage content={message.content} />
              : <p className="message__plain-text">{message.content}</p>}
            {message.response && (
              <>
                <NeedClarifier options={message.response.clarifications} onSelect={onClarify} disabled={loading} />
                {message.response.resources.length > 0 && (
                  <div className="assistant-resources">
                    {message.response.resources.map((resource) => <ResourceRecommendation key={resource.id} resource={resource} />)}
                  </div>
                )}
              </>
            )}
          </div>
        </article>
      ))}
      {loading && <div className="assistant-loading"><i /><i /><i /><span>正在梳理你的需求…</span></div>}
      {error && (
        <div className="assistant-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={onRetry}>重试</button>
        </div>
      )}
    </div>
  )
}
