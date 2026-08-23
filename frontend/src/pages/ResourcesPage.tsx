import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageTransition from '@/components/PageTransition'
import ResourceFilters from '@/components/resources/ResourceFilters'
import ResourceResults from '@/components/resources/ResourceResults'
import { resources } from '@/data/resources'
import type { ResourceCategoryId } from '@/domain/categories'
import { parseResourceFilters } from '@/lib/resourceSearch'
import { listResources, type ResourceListResponse } from '@/services/resourceClient'

export default function ResourcesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = parseResourceFilters(searchParams)
  const [pageData, setPageData] = useState<ResourceListResponse>()
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  const availableTags = useMemo(() => [...new Set(resources
    .filter((resource) => !filters.category || resource.category === filters.category)
    .filter((resource) => !filters.legacyCategory || resource.legacyCategory === filters.legacyCategory)
    .flatMap((resource) => resource.tags))].sort((a, b) => a.localeCompare(b, 'zh-CN')).slice(0, 80), [filters.category, filters.legacyCategory])

  useEffect(() => {
    let active = true
    setPageData(undefined)
    setError(undefined)
    listResources({ query: filters.query, category: filters.category, legacyCategory: filters.legacyCategory, tag: filters.tag, page: filters.page, pageSize: 12 })
      .then((result) => { if (active) setPageData(result) })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : '资源目录暂时不可用，请稍后重试。') })
    return () => { active = false }
  }, [filters.query, filters.category, filters.legacyCategory, filters.tag, filters.page, attempt])

  function updateParams(next: { query?: string; category?: ResourceCategoryId; legacyCategory?: string; tag?: string; page?: number }) {
    const params = new URLSearchParams()
    const query = next.query ?? filters.query
    const category = next.category === undefined && 'category' in next ? undefined : next.category ?? filters.category
    const page = next.page ?? 1
    const legacyCategory = next.legacyCategory === undefined && 'legacyCategory' in next ? undefined : next.legacyCategory ?? filters.legacyCategory
    const tag = next.tag === undefined && 'tag' in next ? undefined : next.tag ?? filters.tag
    if (query) params.set('q', query)
    if (category) params.set('category', category)
    if (legacyCategory) params.set('group', legacyCategory)
    if (tag) params.set('tag', tag)
    if (page > 1) params.set('page', String(page))
    setSearchParams(params)
  }

  function clearFilters() {
    setSearchParams(new URLSearchParams())
  }

  return (
    <PageTransition>
      <header className="resources-hero">
        <div className="shell-width">
          <span className="eyebrow">RESOURCE DIRECTORY · 资源目录</span>
          <h1>把分散的入口，<br />整理成清晰的路径。</h1>
          <p>按需求、关键词或发布单位寻找。所有结果都保留原始页面，重要信息请以发布单位最新说明为准。</p>
        </div>
      </header>
      <section className="resources-workspace shell-width">
        <ResourceFilters
          query={filters.query}
          category={filters.category}
          group={filters.legacyCategory}
          tag={filters.tag}
          tags={availableTags}
          onSearch={(query) => updateParams({ query })}
          onCategoryChange={(category) => updateParams({ category, legacyCategory: undefined, tag: undefined })}
          onGroupChange={(legacyCategory) => updateParams({ legacyCategory, tag: undefined })}
          onTagChange={(tag) => updateParams({ tag })}
          onClear={clearFilters}
        />
        <div className="resource-results">
          {!pageData && !error && <div className="resource-loading" role="status">正在整理校园资源…</div>}
          {error && <div className="resource-empty" role="alert"><h2>资源目录加载失败</h2><p>{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>重新加载</button></div>}
          {pageData && <ResourceResults
            resources={pageData.items}
            total={pageData.total}
            page={pageData.page}
            totalPages={pageData.totalPages}
            onPageChange={(page) => updateParams({ page })}
            onClear={clearFilters}
          />}
        </div>
      </section>
    </PageTransition>
  )
}
