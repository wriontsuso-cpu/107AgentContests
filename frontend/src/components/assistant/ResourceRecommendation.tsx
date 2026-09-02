import { ArrowUpRight } from 'lucide-react'
import type { AssistantResource } from '@/services/assistantClient'

export default function ResourceRecommendation({ resource }: { resource: AssistantResource }) {
  const isEmail = resource.accessStatus === 'email'
  return (
    <a
      className="assistant-resource"
      href={resource.url}
      target={isEmail ? undefined : '_blank'}
      rel={isEmail ? undefined : 'noopener noreferrer'}
      aria-label={`${isEmail ? '发送邮件' : '打开资源'} · ${resource.title}`}
    >
      <span>{resource.category}</span>
      <strong>{resource.title}</strong>
      <p>{resource.summary}</p>
      {resource.accessStatus === 'login_required' && <em className="assistant-resource__access">可能需要登录或校内网络</em>}
      {isEmail && <em className="assistant-resource__access">发送邮件</em>}
      <small>{resource.source}</small>
      <ArrowUpRight size={17} aria-hidden="true" />
    </a>
  )
}
