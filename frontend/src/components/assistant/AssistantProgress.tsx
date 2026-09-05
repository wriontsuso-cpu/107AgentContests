import { Check, Globe2, LoaderCircle, Search, ShieldCheck, Sparkles } from 'lucide-react'
import type { AssistantProgressUpdate } from '@/services/assistantClient'

interface AssistantProgressProps {
  updates: AssistantProgressUpdate[]
  elapsedSeconds: number
}

function StageIcon({ stage }: { stage: string }) {
  if (stage === 'database_search' || stage === 'candidate_review') return <Search size={17} aria-hidden="true" />
  if (stage === 'web_search') return <Globe2 size={17} aria-hidden="true" />
  if (stage === 'page_fetch' || stage === 'answer_verification' || stage === 'source_review') {
    return <ShieldCheck size={17} aria-hidden="true" />
  }
  if (stage === 'finalizing') return <Sparkles size={17} aria-hidden="true" />
  return <LoaderCircle size={17} aria-hidden="true" />
}

export default function AssistantProgress({ updates, elapsedSeconds }: AssistantProgressProps) {
  const visibleUpdates = updates.slice(-5)
  const current = visibleUpdates.at(-1) ?? {
    stage: 'understanding',
    message: '正在梳理你的需求…',
  }

  return (
    <section className="assistant-progress" role="status" aria-label="回答处理进度">
      <header className="assistant-progress__current">
        <span className="assistant-progress__current-icon"><StageIcon stage={current.stage} /></span>
        <div>
          <strong>{current.message}</strong>
          <span>已用时 {elapsedSeconds} 秒，页面会在核实完成后自动更新</span>
        </div>
      </header>
      {visibleUpdates.length > 1 && (
        <ol className="assistant-progress__history" aria-label="已完成的处理步骤">
          {visibleUpdates.slice(0, -1).map((update, index) => (
            <li key={`${update.stage}-${update.message}-${index}`}>
              <Check size={13} aria-hidden="true" />
              <span>{update.message}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
