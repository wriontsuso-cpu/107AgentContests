import { History, Lightbulb, RotateCcw, Search, Sparkles, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import PageTransition from '@/components/PageTransition'
import { randomUuid } from '@/lib/randomUuid'
import Conversation, { type ConversationMessage } from '@/components/assistant/Conversation'
import PromptComposer from '@/components/assistant/PromptComposer'
import CanvasPage from '@/components/visual/CanvasPage'
import DecorativeArtwork from '@/components/visual/DecorativeArtwork'
import { pageVisuals } from '@/data/pagePhotography'
import {
  assistantStarterPrompts,
  closeAssistantSession,
  requestAssistant,
  type AssistantClient,
  type AssistantHistoryMessage,
} from '@/services/assistantClient'
import { useAccount } from '@/profile/AccountContext'
import type { StoredConversation } from '@/profile/types'

interface AssistantPageProps {
  client?: AssistantClient
}

const openingMessage: ConversationMessage = {
  id: 'opening',
  role: 'assistant',
  content: '你不需要知道资源叫什么。告诉我你想完成的事情，我会先帮你理清需求，再给出可以直接查看的校园入口。',
}

export default function AssistantPage({ client = requestAssistant }: AssistantPageProps) {
  const { activeAccount, conversations, storageAvailable, saveConversation, deleteConversation, pendingGuestConversation, offerGuestConversation, clearGuestConversation } = useAccount()
  const [messages, setMessages] = useState<ConversationMessage[]>([openingMessage])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [lastMessage, setLastMessage] = useState('')
  const [sessionId, setSessionId] = useState<string>()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyQuery, setHistoryQuery] = useState('')
  const conversationId = useRef<string>(randomUuid())
  const conversationCreatedAt = useRef(new Date().toISOString())
  const historyToggleRef = useRef<HTMLButtonElement>(null)
  const historySearchRef = useRef<HTMLInputElement>(null)
  const clues = useMemo(
    () => [...new Set(messages.flatMap((message) => message.response?.clues ?? []))],
    [messages],
  )
  const visibleConversations = useMemo(() => {
    const query = historyQuery.trim().toLocaleLowerCase('zh-CN')
    if (!query) return conversations
    return conversations.filter((conversation) => conversation.title.toLocaleLowerCase('zh-CN').includes(query))
  }, [conversations, historyQuery])

  useEffect(() => {
    if (!historyOpen) return
    historySearchRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeHistory()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [historyOpen])

  function closeHistory() {
    setHistoryOpen(false)
    queueMicrotask(() => historyToggleRef.current?.focus())
  }

  useEffect(() => {
    if (activeAccount || !messages.some((message) => message.role === 'user')) return
    const now = new Date().toISOString()
    offerGuestConversation({
      id: conversationId.current,
      title: messages.find((item) => item.role === 'user')?.content.slice(0, 28) || '未命名会话',
      messages: messages.map(({ role, content, response }) => ({ role, content, response })),
      createdAt: conversationCreatedAt.current,
      updatedAt: now,
    })
  }, [activeAccount, messages, offerGuestConversation])

  async function keepGuestConversation() {
    if (!pendingGuestConversation) return
    const saved = await saveConversation(pendingGuestConversation)
    if (saved) {
      restoreConversation(saved)
      clearGuestConversation()
    }
  }

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
      const assistantMessage: ConversationMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        response,
      }
      const nextMessages = [...messages, userMessage, assistantMessage]
      setMessages(nextMessages)
      if (activeAccount) {
        const now = new Date().toISOString()
        await saveConversation({
          id: conversationId.current,
          title: nextMessages.find((item) => item.role === 'user')?.content.slice(0, 28) || '未命名会话',
          messages: nextMessages.map(({ role, content, response: messageResponse }) => ({ role, content, response: messageResponse })),
          createdAt: conversationCreatedAt.current,
          updatedAt: now,
        })
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '导航服务暂时不可用，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    const activeSessionId = sessionId
    setMessages([openingMessage])
    setError(undefined)
    setLastMessage('')
    setSessionId(undefined)
    conversationId.current = randomUuid()
    conversationCreatedAt.current = new Date().toISOString()
    if (activeSessionId) void closeAssistantSession(activeSessionId).catch(() => undefined)
  }

  function restoreConversation(conversation: StoredConversation) {
    const activeSessionId = sessionId
    setMessages(conversation.messages.map((message, index) => ({ ...message, id: `restored-${conversation.id}-${index}` })))
    conversationId.current = conversation.id
    conversationCreatedAt.current = conversation.createdAt
    setSessionId(undefined)
    setError(undefined)
    setHistoryOpen(false)
    if (activeSessionId) void closeAssistantSession(activeSessionId).catch(() => undefined)
  }

  return (
    <PageTransition>
      <section className="assistant-page">
        <CanvasPage {...pageVisuals.assistant} className="assistant-canvas">
        <header className="assistant-canvas__hero shell-width">
          <span className="eyebrow"><Sparkles size={13} /> CAMPUS ASSISTANT · 校园助手</span>
          <h1 id="assistant-title" aria-label="先说说，你想做什么。">先说说，<br aria-hidden="true" />你想做什么。</h1>
          <p>一句话就好，剩下的交给我。</p>
          <div className="assistant-mode"><i /><span>{import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_USE_MOCKS !== 'true' ? '服务已连接' : '演示数据模式'}</span></div>
        </header>
        <DecorativeArtwork src="/brand/decorative-cat.svg" className="assistant-cloud-cat" />
        <div className="assistant-workspace assistant-workspace--immersive shell-width">
          <aside
            className={`assistant-history-rail${historyOpen ? ' assistant-history-rail--open' : ''}`}
            aria-label="最近会话与需求线索"
            role={historyOpen ? 'dialog' : undefined}
            aria-modal={historyOpen ? 'true' : undefined}
            hidden={!historyOpen}
          >
            <div className="assistant-history-rail__topline">
              <span><History size={16} />会话与线索</span>
              <button type="button" aria-label="收起最近会话" onClick={closeHistory}><X size={18} /></button>
            </div>
            <section className="conversation-history" aria-label="最近会话">
              <header><History size={17} /><div><span>最近会话</span><small>{activeAccount ? '最多保留 5 次' : '登录后保存'}</small></div></header>
              <label className="conversation-history__search">
                <Search size={14} />
                <input
                  type="search"
                  aria-label="搜索最近会话"
                  placeholder="搜索会话标题"
                  value={historyQuery}
                  ref={historySearchRef}
                  onChange={(event) => setHistoryQuery(event.target.value)}
                />
              </label>
              {visibleConversations.length > 0 ? <ul>{visibleConversations.map((conversation) => <li key={conversation.id}>
                <button type="button" onClick={() => restoreConversation(conversation)}>{conversation.title}<small>{new Date(conversation.updatedAt).toLocaleDateString('zh-CN')}</small></button>
                <button type="button" aria-label="删除会话" onClick={() => void deleteConversation(conversation.id)}><Trash2 size={14} /></button>
              </li>)}</ul> : <p className="conversation-history__empty">{historyQuery ? '没有匹配的会话。' : '还没有保存的对话。'}</p>}
            </section>
            <section className="need-board" aria-label="需求线索">
              <header><Lightbulb size={18} /><div><span>需求线索</span><small>随着对话逐步清晰</small></div></header>
              {clues.length > 0 ? <ol>{clues.map((clue, index) => <li key={clue}><span>0{index + 1}</span>{clue}</li>)}</ol> : <div className="need-board__empty"><i /><p>开始描述后，这里会整理你的方向、时间与参与偏好。</p></div>}
              <footer>AI 结果仅用于导航，最终信息以资源原页面为准。</footer>
            </section>
          </aside>
          {historyOpen && <button className="assistant-history-backdrop" type="button" aria-label="关闭会话抽屉背景" onClick={closeHistory} />}
          <section className="assistant-reading-surface">
            <div className="assistant-chat__toolbar">
              <div><span>需求对话</span><small>{activeAccount ? `${activeAccount.username} · 自动保存最近 5 次` : '访客模式 · 对话不会保存'}</small></div>
              <div>
                <button
                  className="assistant-history-toggle"
                  type="button"
                  ref={historyToggleRef}
                  aria-label={historyOpen ? '收起最近会话' : '展开最近会话'}
                  aria-expanded={historyOpen}
                  onClick={() => historyOpen ? closeHistory() : setHistoryOpen(true)}
                ><History size={14} />最近会话</button>
                <button type="button" onClick={reset}><RotateCcw size={14} />重新开始</button>
              </div>
            </div>
            {!storageAvailable && <div className="assistant-storage-warning" role="status">本机存储不可用，本次对话不会保存。</div>}
            {activeAccount && pendingGuestConversation && <div className="guest-transfer-prompt">
              <span>发现一段刚才的访客对话，要保存到“{activeAccount.username}”吗？</span>
              <button type="button" onClick={() => void keepGuestConversation()}>保存当前对话</button>
              <button type="button" onClick={clearGuestConversation}>暂不保存</button>
            </div>}
            {messages.length === 1 && (
              <div className="starter-prompts" aria-label="快捷提问">
                {assistantStarterPrompts.map((prompt) => <button key={prompt} type="button" onClick={() => sendMessage(prompt)}>{prompt}</button>)}
              </div>
            )}
            <Conversation account={activeAccount} messages={messages} loading={loading} error={error} onClarify={sendMessage} onRetry={() => sendMessage(lastMessage)} />
            <PromptComposer onSubmit={sendMessage} disabled={loading} />
          </section>
        </div>
        </CanvasPage>
      </section>
    </PageTransition>
  )
}
