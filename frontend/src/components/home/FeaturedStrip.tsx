import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { featuredResources } from '@/data/featuredResources'
import { getCategory } from '@/domain/categories'

export default function FeaturedStrip() {
  return (
    <section className="featured shell-width" aria-labelledby="featured-title">
      <header className="featured__heading">
        <div>
          <span className="eyebrow">QUICK ACCESS · 快速抵达</span>
          <h2 id="featured-title">近期常用入口</h2>
        </div>
        <Link to="/resources">查看全部资源 <ArrowRight size={17} aria-hidden="true" /></Link>
      </header>
      <div className="featured__list">
        {featuredResources.map((resource, index) => (
          <article className="featured-row" key={resource.id}>
            <span className="featured-row__index">0{index + 1}</span>
            <div className="featured-row__main">
              <span>{getCategory(resource.category).shortLabel} · {resource.source.label}</span>
              <h3>{resource.title}</h3>
              <p>{resource.summary}</p>
            </div>
            <Link to={`/resources/${resource.id}`} aria-label={`查看资源 · ${resource.title}`}>
              查看资源
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  )
}
