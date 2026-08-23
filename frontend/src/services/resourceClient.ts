import { resources } from '@/data/resources'
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
    return paginateResources(searchResources(resources, request), request.page, request.pageSize ?? 12)
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
  if (shouldUseMocks(apiBaseUrl, options.useMocks)) return resources.find((resource) => resource.id === id)

  const response = await (options.fetcher ?? fetch)(`${apiBaseUrl.replace(/\/$/, '')}/api/resources/${encodeURIComponent(id)}`, {
    signal: AbortSignal.timeout(12_000),
  })
  if (response.status === 404) return undefined
  if (!response.ok) throw new Error('资源详情暂时不可用，请稍后重试。')
  return adaptResource(await response.json()) ?? undefined
}
