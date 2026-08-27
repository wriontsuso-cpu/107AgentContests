import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageTransition from '@/components/PageTransition'
import ResourceFilters from '@/components/resources/ResourceFilters'
import ResourceResults from '@/components/resources/ResourceResults'
import CanvasPage from '@/components/visual/CanvasPage'
import DecorativeArtwork from '@/components/visual/DecorativeArtwork'
import GlassPanel from '@/components/visual/GlassPanel'
import { pageVisuals } from '@/data/pagePhotography'
import { resources } from '@/data/resources'
import type { ResourceCategoryId } from '@/domain/categories'
import { parseResourceFilters } from '@/lib/resourceSearch'
import { useProfile } from '@/profile/ProfileContext'
import { getResourceTags, listResources, type ResourceListResponse } from '@/services/resourceClient'

export default function ResourcesPage() {
  const { searches, saveSearch, deleteSearch } = useProfile()
  const [searchParams, setSearchParams] = useSearchParams()
  const paramsRef = useRef(searchParams)
  paramsRef.current = searchParams
  const filters = parseResourceFilters(searchParams)
  const [pageData, setPageData] = useState<ResourceListResponse>()
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  const localTags = useMemo(() => [...new Set(resources
    .filter((resource) => !filters.category || resource.category === filters.category)
    .filter((resource) => !filters.legacyCategory || resource.legacyCategory === filters.legacyCategory)
    .flatMap((resource) => resource.tags))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [filters.category, filters.legacyCategory])
  const [availableTags, setAvailableTags] = useState<string[]>(localTags)
  const saveSearchRef = useRef(saveSearch)
  saveSearchRef.current = saveSearch

  useEffect(() => {
    const query = filters.query.trim()
    if (!query) return
    void saveSearchRef.current(query)
  }, [filters.query])

  useEffect(() => {
    let active = true
    getResourceTags().then((tags) => { if (active) setAvailableTags(tags.length > 0 ? tags : localTags) }).catch(() => { if (active) setAvailableTags(localTags) })
    return () => { active = false }
  }, [localTags])

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
    const currentFilters = parseResourceFilters(paramsRef.current)
    const params = new URLSearchParams()
    const query = next.query ?? currentFilters.query
    const category = next.category === undefined && 'category' in next ? undefined : next.category ?? currentFilters.category
    const page = next.page ?? 1
    const legacyCategory = next.legacyCategory === undefined && 'legacyCategory' in next ? undefined : next.legacyCategory ?? currentFilters.legacyCategory
    const tag = next.tag === undefined && 'tag' in next ? undefined : next.tag ?? currentFilters.tag
    if (query) params.set('q', query)
    if (category) params.set('category', category)
    if (legacyCategory) params.set('group', legacyCategory)
    if (tag) params.set('tag', tag)
    if (page > 1) params.set('page', String(page))
    paramsRef.current = params
    setSearchParams(params)
  }

  function clearFilters() {
    setSearchParams(new URLSearchParams())
  }

  return (
    <PageTransition>
      <CanvasPage {...pageVisuals.resources} className="resources-canvas">
        <header className="resources-canvas__intro shell-width">
          <span className="eyebrow">RESOURCE DIRECTORY · 资源目录</span>
          <h1 id="resources-title" aria-label="要找的入口，从这里出发。">要找的入口，<br aria-hidden="true" />从这里出发。</h1>
          <p>搜索、筛选，直接去官方页面。</p>
        </header>
        <section className="resources-workspace shell-width" aria-labelledby="resources-title">
          <GlassPanel tone="warm" className="resources-filter-panel">
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
              recentSearches={searches}
              onDeleteSearch={(searchId) => void deleteSearch(searchId)}
            />
          </GlassPanel>
          <GlassPanel tone="warm" className="resource-results">
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
          </GlassPanel>
        </section>
        <DecorativeArtwork src="/brand/decorative-route.svg" className="resources-route-art" />
      </CanvasPage>
    </PageTransition>
  )
}
