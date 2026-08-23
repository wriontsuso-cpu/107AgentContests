import { ArrowLeft, ExternalLink, Info, Lightbulb } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import PageTransition from '@/components/PageTransition'
import RelatedResources from '@/components/resources/RelatedResources'
import ResourceMetadata from '@/components/resources/ResourceMetadata'
import { resourceById } from '@/data/resources'
import { getCategory } from '@/domain/categories'

export default function ResourceDetailPage() {
  const { id = '' } = useParams()
  const resource = resourceById.get(id)

  if (!resource) {
    return (
      <PageTransition>
        <section className="detail-missing shell-width">
          <Info size={34} strokeWidth={1.4} aria-hidden="true" />
          <h1>这条资源暂时找不到</h1>
          <p>它可能已被更新、合并或移除。回到资源大厅可以继续搜索最新入口。</p>
          <Link className="button button--primary" to="/resources"><ArrowLeft size={17} />返回资源大厅</Link>
        </section>
      </PageTransition>
    )
  }

  const category = getCategory(resource.category)

  return (
    <PageTransition>
      <article className="detail-page">
        <header className="detail-hero">
          <div className="shell-width">
            <nav className="detail-breadcrumb" aria-label="面包屑">
              <Link to="/resources">资源大厅</Link>
              <span>/</span>
              <Link to={`/resources?category=${category.id}`}>{category.label}</Link>
            </nav>
            <div className="detail-hero__grid">
              <div>
                <span className="detail-category" style={{ borderColor: category.accent }}>{category.label}</span>
                <h1>{resource.title}</h1>
                <p>{resource.summary}</p>
              </div>
              <a className="detail-primary-link" href={resource.url} target="_blank" rel="noopener noreferrer" aria-label="前往资源原页面">
                <span>完成这件事</span>
                <strong>前往资源原页面</strong>
                <ExternalLink size={21} aria-hidden="true" />
              </a>
            </div>
          </div>
        </header>
        <div className="detail-content shell-width">
          <div className="detail-main">
            <section aria-labelledby="detail-about">
              <span className="eyebrow">ABOUT THIS RESOURCE</span>
              <h2 id="detail-about">资源说明</h2>
              <p>{resource.content || resource.summary}</p>
            </section>
            {resource.howTo && (
              <section className="detail-howto" aria-labelledby="detail-howto">
                <Lightbulb size={22} strokeWidth={1.6} aria-hidden="true" />
                <div>
                  <h2 id="detail-howto">如何使用</h2>
                  <p>{resource.howTo}</p>
                </div>
              </section>
            )}
            {resource.tags.length > 0 && (
              <div className="detail-tags" aria-label="资源标签">
                {resource.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            )}
          </div>
          <aside className="detail-aside">
            <ResourceMetadata resource={resource} />
            <p>资源内容与办理规则可能变化，请以原发布单位页面为准。</p>
          </aside>
        </div>
        <RelatedResources current={resource} />
      </article>
    </PageTransition>
  )
}
