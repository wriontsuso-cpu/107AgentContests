import { loadLocalCatalog } from '@/data/localCatalog'
import { adaptResource, adaptResourceCollection } from '@/data/resourceAdapter'
import type { Resource } from '@/domain/resource'
import { paginateResources, searchResources, type ResourceFilters } from '@/lib/resourceSearch'

export interface ResourceListRequest extends ResourceFilters {
  page?: number
  pageSize?: number
}

export interface ResourceListResponse {
  items: Resource[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface ClientOptions {
  apiBaseUrl?: string
  useMocks?: boolean
  fetcher?: typeof fetch
}

function shouldUseMocks(apiBaseUrl: string, explicit?: boolean): boolean {
  return explicit ?? (import.meta.env.VITE_USE_MOCKS === 'true' || !apiBaseUrl)
}

export async function listResources(request: ResourceListRequest, options: ClientOptions = {}): Promise<ResourceListResponse> {
  const apiBaseUrl = options.apiBaseUrl ?? import.meta.env.VITE_API_BASE_URL ?? ''
  if (shouldUseMocks(apiBaseUrl, options.useMocks)) {
    const localResources = await loadLocalCatalog()
    await new Promise((resolve) => setTimeout(resolve, 0))
    return paginateResources(searchResources(localResources, request), request.page, request.pageSize ?? 12)
  }

  const params = new URLSearchParams()
  if (request.query) params.set('q', request.query)
  if (request.category) params.set('category', request.category)
  if (request.legacyCategory) params.set('group', request.legacyCategory)
  if (request.tag) params.set('tag', request.tag)
  params.set('page', String(request.page ?? 1))
  params.set('page_size', String(request.pageSize ?? 12))

  const response = await (options.fetcher ?? fetch)(`${apiBaseUrl.replace(/\/$/, '')}/api/resources?${params}`, {
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) throw new Error('资源目录暂时不可用，请稍后重试。')
  const payload: unknown = await response.json()
  const row = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {}
  const items = adaptResourceCollection(row.items ?? row.resources ?? payload)
  const total = typeof row.total === 'number' ? row.total : items.length
  const page = typeof row.page === 'number' ? row.page : request.page ?? 1
  const pageSize = typeof row.page_size === 'number' ? row.page_size : request.pageSize ?? 12
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

export async function getResourceById(id: string, options: ClientOptions = {}): Promise<Resource | undefined> {
  const apiBaseUrl = options.apiBaseUrl ?? import.meta.env.VITE_API_BASE_URL ?? ''
  if (shouldUseMocks(apiBaseUrl, options.useMocks)) return (await loadLocalCatalog()).find((resource) => resource.id === id)

  const response = await (options.fetcher ?? fetch)(`${apiBaseUrl.replace(/\/$/, '')}/api/resources/${encodeURIComponent(id)}`, {
    signal: AbortSignal.timeout(12_000),
  })
  if (response.status === 404) return undefined
  if (!response.ok) throw new Error('资源详情暂时不可用，请稍后重试。')
  return adaptResource(await response.json()) ?? undefined
}

export async function getResourceTags(options: ClientOptions = {}): Promise<string[]> {
  const apiBaseUrl = options.apiBaseUrl ?? import.meta.env.VITE_API_BASE_URL ?? ''
  if (shouldUseMocks(apiBaseUrl, options.useMocks)) {
    const localResources = await loadLocalCatalog()
    return [...new Set(localResources.flatMap((resource) => resource.tags))].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  }

  const response = await (options.fetcher ?? fetch)(`${apiBaseUrl.replace(/\/$/, '')}/api/categories`, {
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) throw new Error('筛选项暂时不可用。')
  const payload: unknown = await response.json()
  const row = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {}
  const categories = Array.isArray(payload) ? payload : Array.isArray(row.categories) ? row.categories : []
  const rootTags = Array.isArray(row.tags) ? row.tags : []
  const categoryTags = categories.flatMap((category) => category && typeof category === 'object' && Array.isArray((category as Record<string, unknown>).tags)
    ? (category as Record<string, unknown>).tags as unknown[]
    : [])
  return [...new Set([...rootTags, ...categoryTags].filter((tag): tag is string => typeof tag === 'string' && Boolean(tag.trim())).map((tag) => tag.trim()))]
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
}
