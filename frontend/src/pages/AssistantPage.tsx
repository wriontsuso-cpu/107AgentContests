import { History, Lightbulb, MessageSquarePlus, RotateCcw, Search, Sparkles, Trash2, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import PageTransition from '@/components/PageTransition'
import Conversation, { type ConversationMessage } from '@/components/assistant/Conversation'
import PromptComposer from '@/components/assistant/PromptComposer'
import CanvasPage from '@/components/visual/CanvasPage'
import DecorativeArtwork from '@/components/visual/DecorativeArtwork'
import GlassPanel from '@/components/visual/GlassPanel'
import { pageVisuals } from '@/data/pagePhotography'
import {
  assistantStarterPrompts,
  closeAssistantSession,
  requestAssistant,
  type AssistantClient,
  type AssistantHistoryMessage,
} from '@/services/assistantClient'
import { useProfile } from '@/profile/ProfileContext'
import type { ConversationDraft, StoredConversation } from '@/profile/types'

interface AssistantPageProps {
  client?: AssistantClient
}

const openingMessage: ConversationMessage = {
  id: 'opening',
  role: 'assistant',
  content: '你不需要知道资源叫什么。告诉我你想完成的事情，我会先帮你理清需求，再给出可以直接查看的校园入口。',
}

function conversationDraft(
  id: string,
  createdAt: string,
  messages: ConversationMessage[],
): ConversationDraft {
  return {
    id,
    title: messages.find((item) => item.role === 'user')?.content.slice(0, 28) || '未命名会话',
    messages: messages.map(({ role, content, response }) => ({ role, content, response })),
    createdAt,
    updatedAt: new Date().toISOString(),
  }
}

export default function AssistantPage({ client = requestAssistant }: AssistantPageProps) {
  const { activeProfile, conversations, storageAvailable, saveConversation, deleteConversation } = useProfile()
  const [messages, setMessages] = useState<ConversationMessage[]>([openingMessage])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [lastMessage, setLastMessage] = useState('')
  const [sessionId, setSessionId] = useState<string>()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyQuery, setHistoryQuery] = useState('')
  const conversationId = useRef<string>(crypto.randomUUID())
  const conversationCreatedAt = useRef(new Date().toISOString())

  const clues = useMemo(
    () => [...new Set(messages.flatMap((message) => message.response?.clues ?? []))],
    [messages],
  )
  const filteredConversations = useMemo(() => {
    const query = historyQuery.trim().toLocaleLowerCase('zh-CN')
    if (!query) return conversations
    return conversations.filter((conversation) =>
      [conversation.title, ...conversation.messages.map((message) => message.content)]
        .some((value) => value.toLocaleLowerCase('zh-CN').includes(query)),
    )
  }, [conversations, historyQuery])

  async function persistConversation(nextMessages: ConversationMessage[], id = conversationId.current, createdAt = conversationCreatedAt.current) {
    if (!nextMessages.some((message) => message.role === 'user')) return
    await saveConversation(conversationDraft(id, createdAt, nextMessages))
  }

  async function sendMessage(message: string) {
    const history: AssistantHistoryMessage[] = messages.map(({ role, content }) => ({ role, content }))
    const userMessage: ConversationMessage = { id: `user-${crypto.randomUUID()}`, role: 'user', content: message }
    const messagesWithQuestion = [...messages, userMessage]
    const requestConversationId = conversationId.current
    const requestCreatedAt = conversationCreatedAt.current

    setMessages(messagesWithQuestion)
    setLastMessage(message)
    setLoading(true)
    setError(undefined)
    await persistConversation(messagesWithQuestion, requestConversationId, requestCreatedAt)

    try {
      const response = await client({ message, history, sessionId })
      if (response.sessionId) setSessionId(response.sessionId)
      const assistantMessage: ConversationMessage = {
        id: `assistant-${crypto.randomUUID()}`,
        role: 'assistant',
        content: response.reply,
        response,
      }
      const completedMessages = [...messagesWithQuestion, assistantMessage]
      setMessages(completedMessages)
      await persistConversation(completedMessages, requestConversationId, requestCreatedAt)
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
    conversationId.current = crypto.randomUUID()
    conversationCreatedAt.current = new Date().toISOString()
    if (activeSessionId) void closeAssistantSession(activeSessionId).catch(() => undefined)
  }

  function restoreConversation(conversation: StoredConversation) {
    const activeSessionId = sessionId
    setMessages(conversation.messages.map((message, index) => ({ ...message, id: `restored-${conversation.id}-${index}` })))
    conversationId.current = conversation.id
    conversationCreatedAt.current = conversation.createdAt
    setLastMessage([...conversation.messages].reverse().find((message) => message.role === 'user')?.content ?? '')
    setSessionId(undefined)
    setError(undefined)
    setHistoryOpen(false)
    if (activeSessionId) void closeAssistantSession(activeSessionId).catch(() => undefined)
  }

  async function removeConversation(conversation: StoredConversation) {
    await deleteConversation(conversation.id)
    if (conversation.id === conversationId.current) reset()
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
          <DecorativeArtwork src="/brand/decorative-route.svg" className="assistant-route-art" />
        </header>
        <div className="assistant-workspace assistant-workspace--glass shell-width">
          <GlassPanel tone="warm" className="assistant-chat">
            <div className="assistant-chat__toolbar">
              <div><span>需求对话</span><small>{activeProfile ? `${activeProfile.nickname} · 本机保存 ${conversations.length} 次会话` : `本机保存 · ${conversations.length} 次会话`}</small></div>
              <div>
                <button className="assistant-history-toggle" type="button" onClick={() => setHistoryOpen(true)}><History size={14} />历史记录</button>
                <button type="button" onClick={reset} disabled={loading}><RotateCcw size={14} />新对话</button>
              </div>
            </div>
            {!storageAvailable && <div className="assistant-storage-warning" role="status">本机存储不可用，本次对话不会保存。</div>}
            {messages.length === 1 && (
              <div className="starter-prompts" aria-label="快捷提问">
                {assistantStarterPrompts.map((prompt) => <button key={prompt} type="button" onClick={() => sendMessage(prompt)}>{prompt}</button>)}
              </div>
            )}
            <Conversation messages={messages} loading={loading} error={error} onClarify={sendMessage} onRetry={() => sendMessage(lastMessage)} />
            <PromptComposer onSubmit={sendMessage} disabled={loading} />
          </GlassPanel>
          <GlassPanel tone="navy" className={`assistant-side${historyOpen ? ' assistant-side--open' : ''}`}>
            <button className="assistant-side__close" type="button" aria-label="关闭历史记录" onClick={() => setHistoryOpen(false)}><X /></button>
            <aside className="conversation-history" aria-label="历史记录">
              <header><History size={17} /><div><span>历史记录</span><small>仅保存在当前浏览器</small></div></header>
              <button className="conversation-history__new" type="button" onClick={reset} disabled={loading}><MessageSquarePlus size={15} />新对话</button>
              <label className="conversation-history__search">
                <Search size={14} aria-hidden="true" />
                <input aria-label="搜索历史记录" value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="搜索历史记录" />
              </label>
              {filteredConversations.length > 0 ? <ul>{filteredConversations.map((conversation) => <li className={conversation.id === conversationId.current ? 'conversation-history__item--active' : undefined} key={conversation.id}>
                <button type="button" onClick={() => restoreConversation(conversation)}>{conversation.title}<small>{new Date(conversation.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small></button>
                <button type="button" title="删除会话" aria-label={`删除会话：${conversation.title}`} onClick={() => void removeConversation(conversation)}><Trash2 size={14} /></button>
              </li>)}</ul> : <p className="conversation-history__empty">{historyQuery ? '没有匹配的历史记录。' : '还没有保存的对话。'}</p>}
            </aside>
            <aside className="need-board" aria-label="需求线索">
              <header><Lightbulb size={18} /><div><span>需求线索</span><small>随着对话逐步清晰</small></div></header>
              {clues.length > 0 ? <ol>{clues.map((clue, index) => <li key={clue}><span>0{index + 1}</span>{clue}</li>)}</ol> : <div className="need-board__empty"><i /><p>开始描述后，这里会整理你的方向、时间与参与偏好。</p></div>}
              <footer>AI 结果仅用于导航，最终信息以资源原页面为准。</footer>
            </aside>
          </GlassPanel>
        </div>
        </CanvasPage>
      </section>
    </PageTransition>
  )
}
