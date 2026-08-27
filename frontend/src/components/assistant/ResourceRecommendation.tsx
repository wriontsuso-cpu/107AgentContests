import { ArrowUpRight } from 'lucide-react'
import type { AssistantResource } from '@/services/assistantClient'

export default function ResourceRecommendation({ resource }: { resource: AssistantResource }) {
  return (
    <a className="assistant-resource" href={resource.url} target="_blank" rel="noopener noreferrer">
      <span>{resource.category}</span>
      <strong>{resource.title}</strong>
      <p>{resource.summary}</p>
      <small>{resource.source}</small>
      <ArrowUpRight size={17} aria-hidden="true" />
    </a>
  )
}
