import { Lightbulb, RotateCcw, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import PageTransition from '@/components/PageTransition'
import Conversation, { type ConversationMessage } from '@/components/assistant/Conversation'
import PromptComposer from '@/components/assistant/PromptComposer'
import {
  assistantStarterPrompts,
  requestAssistant,
  type AssistantClient,
  type AssistantHistoryMessage,
} from '@/services/assistantClient'

interface AssistantPageProps {
  client?: AssistantClient
}

const openingMessage: ConversationMessage = {
  id: 'opening',
  role: 'assistant',
  content: '你不需要知道资源叫什么。告诉我你想完成的事情，我会先帮你理清需求，再给出可以直接查看的校园入口。',
}

export default function AssistantPage({ client = requestAssistant }: AssistantPageProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([openingMessage])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [lastMessage, setLastMessage] = useState('')
  const [sessionId, setSessionId] = useState<string>()
  const clues = useMemo(
    () => [...new Set(messages.flatMap((message) => message.response?.clues ?? []))],
    [messages],
  )

  async function sendMessage(message: string) {
    const history: AssistantHistoryMessage[] = messages.map(({ role, content }) => ({ role, content }))
    const userMessage: ConversationMessage = { id: `user-${Date.now()}`, role: 'user', content: message }
    setMessages((current) => [...current, userMessage])
    setLastMessage(message)
    setLoading(true)
    setError(undefined)

    try {
      const response = await client({ message, history, sessionId })
      if (response.sessionId) setSessionId(response.sessionId)
      setMessages((current) => [...current, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        response,
      }])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '导航服务暂时不可用，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setMessages([openingMessage])
    setError(undefined)
    setLastMessage('')
    setSessionId(undefined)
  }

  return (
    <PageTransition>
      <section className="assistant-page">
        <header className="assistant-header shell-width">
          <div>
            <span className="eyebrow"><Sparkles size={13} /> GUIDED NAVIGATION · 引导式导航</span>
            <h1>先说说，你现在想做什么？</h1>
            <p>我们从你的目标出发，而不是让你猜部门和系统的名字。</p>
          </div>
          <div className="assistant-mode">
            <i />
            <span>{import.meta.env.VITE_API_BASE_URL ? '服务已连接' : '演示数据模式'}</span>
          </div>
        </header>
        <div className="assistant-workspace shell-width">
          <div className="assistant-chat">
            <div className="assistant-chat__toolbar">
              <span>需求对话</span>
              <button type="button" onClick={reset}><RotateCcw size={14} />重新开始</button>
            </div>
            {messages.length === 1 && (
              <div className="starter-prompts" aria-label="快捷提问">
                {assistantStarterPrompts.map((prompt) => <button key={prompt} type="button" onClick={() => sendMessage(prompt)}>{prompt}</button>)}
              </div>
            )}
            <Conversation messages={messages} loading={loading} error={error} onClarify={sendMessage} onRetry={() => sendMessage(lastMessage)} />
            <PromptComposer onSubmit={sendMessage} disabled={loading} />
          </div>
          <aside className="need-board" aria-label="需求线索">
            <header>
              <Lightbulb size={18} />
              <div><span>需求线索</span><small>随着对话逐步清晰</small></div>
            </header>
            {clues.length > 0 ? (
              <ol>{clues.map((clue, index) => <li key={clue}><span>0{index + 1}</span>{clue}</li>)}</ol>
            ) : (
              <div className="need-board__empty">
                <i />
                <p>开始描述后，这里会整理你的方向、时间与参与偏好。</p>
              </div>
            )}
            <footer>AI 结果仅用于导航，最终信息以资源原页面为准。</footer>
          </aside>
        </div>
      </section>
    </PageTransition>
  )
}
