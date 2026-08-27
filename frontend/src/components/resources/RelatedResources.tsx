import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { resources } from '@/data/resources'
import type { Resource } from '@/domain/resource'

export default function RelatedResources({ current }: { current: Resource }) {
  const related = resources
    .filter((resource) => resource.id !== current.id && resource.category === current.category)
    .sort((a, b) => {
      const aOverlap = a.tags.filter((tag) => current.tags.includes(tag)).length
      const bOverlap = b.tags.filter((tag) => current.tags.includes(tag)).length
      return bOverlap - aOverlap || b.relevanceScore - a.relevanceScore
    })
    .slice(0, 3)

  if (related.length === 0) return null

  return (
    <section className="related-resources" aria-labelledby="related-title">
      <header>
        <span className="eyebrow">KEEP EXPLORING</span>
        <h2 id="related-title">或许你还需要</h2>
      </header>
      <div>
        {related.map((resource) => (
          <Link key={resource.id} to={`/resources/${resource.id}`} aria-label={`相关资源 · ${resource.title}`}>
            <span>{resource.source.label}</span>
            <strong>{resource.title}</strong>
            <p>{resource.summary}</p>
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  )
}
