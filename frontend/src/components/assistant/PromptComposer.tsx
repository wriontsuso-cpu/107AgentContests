import { ArrowUp } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useState } from 'react'

interface PromptComposerProps {
  onSubmit: (message: string) => void
  disabled?: boolean
}

export default function PromptComposer({ onSubmit, disabled }: PromptComposerProps) {
  const [draft, setDraft] = useState('')

  function submit(event?: FormEvent) {
    event?.preventDefault()
    const message = draft.trim()
    if (!message || disabled) return
    setDraft('')
    onSubmit(message)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form className="prompt-composer" onSubmit={submit}>
      <textarea
        rows={2}
        value={draft}
        aria-label="描述你的需求"
        placeholder="比如：我想找一个这学期能参加的科创项目……"
        disabled={disabled}
        onKeyDown={handleKeyDown}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button type="submit" aria-label="发送消息" disabled={disabled || !draft.trim()}>
        <ArrowUp size={19} aria-hidden="true" />
      </button>
      <span>Enter 发送 · Shift + Enter 换行</span>
    </form>
  )
}
