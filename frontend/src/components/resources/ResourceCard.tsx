import { ArrowUpRight } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { getCategory } from '@/domain/categories'
import type { Resource } from '@/domain/resource'

export default function ResourceCard({ resource }: { resource: Resource }) {
  const category = getCategory(resource.category)
  const content = (
    <>
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
        <span className="resource-card__destination">
          {resource.url ? '打开官方页面' : '查看站内详情'}
          <ArrowUpRight size={15} aria-hidden="true" />
        </span>
      </div>
    </>
  )

  if (resource.url) return <a className="resource-card" href={resource.url} target="_blank" rel="noopener noreferrer" aria-label={`打开官方页面 · ${resource.title}`}>{content}</a>
  return <Link className="resource-card" to={`/resources/${resource.id}`} aria-label={`查看站内详情 · ${resource.title}`}>{content}</Link>
}
