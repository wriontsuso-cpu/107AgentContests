import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AssistantResource } from '@/services/assistantClient'

export default function ResourceRecommendation({ resource }: { resource: AssistantResource }) {
  return (
    <Link className="assistant-resource" to={resource.url}>
      <span>{resource.category}</span>
      <strong>{resource.title}</strong>
      <p>{resource.summary}</p>
      <ArrowUpRight size={17} aria-hidden="true" />
    </Link>
  )
}
