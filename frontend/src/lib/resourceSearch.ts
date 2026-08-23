import { CATEGORY_IDS, type ResourceCategoryId } from '@/domain/categories'
import type { Resource } from '@/domain/resource'

export interface ResourceFilters {
  query?: string
  category?: ResourceCategoryId
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('zh-CN')
}

function scoreResource(resource: Resource, query: string): number {
  if (!query) return 0

  const title = normalized(resource.title)
  const tags = resource.tags.map(normalized)
  const summary = normalized(resource.summary)
  const searchText = normalized(resource.searchText)

  if (title === query) return 1000 + resource.relevanceScore
  if (title.includes(query)) return 600 + resource.relevanceScore
  if (tags.some((tag) => tag.includes(query))) return 350 + resource.relevanceScore
  if (summary.includes(query) || searchText.includes(query)) return 100 + resource.relevanceScore
  return -1
}

export function searchResources(source: readonly Resource[], filters: ResourceFilters): Resource[] {
  const query = normalized(filters.query ?? '')

  return source
    .map((resource, index) => ({ resource, index, score: scoreResource(resource, query) }))
    .filter(({ resource, score }) => {
      const categoryMatches = !filters.category || resource.category === filters.category
      const queryMatches = !query || score >= 0
      return categoryMatches && queryMatches
    })
    .sort((a, b) => query ? b.score - a.score || a.index - b.index : a.index - b.index)
    .map(({ resource }) => resource)
}

export function paginateResources(source: readonly Resource[], page = 1, pageSize = 12) {
  const totalPages = Math.max(1, Math.ceil(source.length / pageSize))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const start = (currentPage - 1) * pageSize

  return {
    items: source.slice(start, start + pageSize),
    page: currentPage,
    pageSize,
    total: source.length,
    totalPages,
  }
}

export function parseResourceFilters(params: URLSearchParams): { query: string; category?: ResourceCategoryId; page: number } {
  const query = params.get('q')?.trim() ?? ''
  const categoryValue = params.get('category')
  const category = CATEGORY_IDS.find((id) => id === categoryValue)
  const rawPage = Number.parseInt(params.get('page') ?? '1', 10)
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1

  return { query, ...(category ? { category } : {}), page }
}
