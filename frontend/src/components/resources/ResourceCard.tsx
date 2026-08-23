import { ArrowRight, ExternalLink } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { getCategory } from '@/domain/categories'
import type { Resource } from '@/domain/resource'

export default function ResourceCard({ resource }: { resource: Resource }) {
  const category = getCategory(resource.category)

  return (
    <article className="resource-card">
      <div className="resource-card__topline">
        <span style={{ '--dot': category.accent } as CSSProperties}>{category.label}</span>
        <span>{resource.source.authority}</span>
      </div>
      <h2>{resource.title}</h2>
      <p>{resource.summary}</p>
      {resource.tags.length > 0 && (
        <div className="resource-card__tags" aria-label="资源标签">
          {resource.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      )}
      <div className="resource-card__footer">
        <span>{resource.source.label}</span>
        <div>
          {resource.url && (
            <a href={resource.url} target="_blank" rel="noopener noreferrer">
              原页面 <ExternalLink size={14} aria-hidden="true" />
            </a>
          )}
          <Link to={`/resources/${resource.id}`} aria-label={`查看详情 · ${resource.title}`}>
            查看详情 <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  )
}
