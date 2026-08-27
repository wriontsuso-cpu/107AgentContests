import { ArrowLeft, ExternalLink, Info, Lightbulb } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import PageTransition from '@/components/PageTransition'
import RelatedResources from '@/components/resources/RelatedResources'
import ResourceMetadata from '@/components/resources/ResourceMetadata'
import CanvasPage from '@/components/visual/CanvasPage'
import GlassPanel from '@/components/visual/GlassPanel'
import { getCategory } from '@/domain/categories'
import type { Resource } from '@/domain/resource'
import { getResourceById } from '@/services/resourceClient'
import { detailPhotography } from '@/data/pagePhotography'

export default function ResourceDetailPage() {
  const { id = '' } = useParams()
  const [resource, setResource] = useState<Resource>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(undefined)
    getResourceById(id)
      .then((result) => { if (active) setResource(result) })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : '资源详情暂时不可用，请稍后重试。') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, attempt])

  if (loading) return <PageTransition><div className="detail-missing shell-width" role="status">正在核验资源信息…</div></PageTransition>

  if (error) return <PageTransition><section className="detail-missing shell-width"><Info size={34} /><h1>资源详情加载失败</h1><p>{error}</p><button className="button button--primary" type="button" onClick={() => setAttempt((value) => value + 1)}>重新加载</button></section></PageTransition>

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
      <CanvasPage src={detailPhotography[category.id]} alt={`${category.label}校园背景`} loading="lazy" className="detail-canvas">
      <article className="detail-page detail-page--canvas">
        <GlassPanel tone="navy" as="header" className="detail-hero">
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
              {resource.url && <a className="detail-primary-link" href={resource.url} target="_blank" rel="noopener noreferrer" aria-label="前往资源原页面">
                <span>完成这件事</span>
                <strong>前往资源原页面</strong>
                <ExternalLink size={21} aria-hidden="true" />
              </a>}
            </div>
          </div>
        </GlassPanel>
        <div className="detail-content shell-width">
          <GlassPanel tone="warm" className="detail-main">
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
          </GlassPanel>
          <GlassPanel tone="warm" as="aside" className="detail-aside">
            <ResourceMetadata resource={resource} />
            <p>资源内容与办理规则可能变化，请以原发布单位页面为准。</p>
          </GlassPanel>
        </div>
        <GlassPanel tone="warm" className="detail-related-glass"><RelatedResources current={resource} /></GlassPanel>
      </article>
      </CanvasPage>
    </PageTransition>
  )
}
