import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageTransition from '@/components/PageTransition'
import ResourceFilters from '@/components/resources/ResourceFilters'
import ResourceResults from '@/components/resources/ResourceResults'
import { resources } from '@/data/resources'
import type { ResourceCategoryId } from '@/domain/categories'
import { paginateResources, parseResourceFilters, searchResources } from '@/lib/resourceSearch'

export default function ResourcesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = parseResourceFilters(searchParams)
  const filtered = useMemo(
    () => searchResources(resources, { query: filters.query, category: filters.category }),
    [filters.query, filters.category],
  )
  const pageData = paginateResources(filtered, filters.page, 12)

  function updateParams(next: { query?: string; category?: ResourceCategoryId; page?: number }) {
    const params = new URLSearchParams()
    const query = next.query ?? filters.query
    const category = next.category === undefined && 'category' in next ? undefined : next.category ?? filters.category
    const page = next.page ?? 1
    if (query) params.set('q', query)
    if (category) params.set('category', category)
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
          onSearch={(query) => updateParams({ query })}
          onCategoryChange={(category) => updateParams({ category })}
          onClear={clearFilters}
        />
        <div className="resource-results">
          <ResourceResults
            resources={pageData.items}
            total={pageData.total}
            page={pageData.page}
            totalPages={pageData.totalPages}
            onPageChange={(page) => updateParams({ page })}
            onClear={clearFilters}
          />
        </div>
      </section>
    </PageTransition>
  )
}
