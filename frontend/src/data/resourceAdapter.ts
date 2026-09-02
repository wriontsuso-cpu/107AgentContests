import { resolveCategory } from '@/domain/categories'
import type { Resource } from '@/domain/resource'

type UnknownRecord = Record<string, unknown>

const FALLBACK_SUMMARY = '访问资源原页面，查看最新说明与办理方式。'
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asWeight(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return 0
}

function optionalString(value: unknown): string | undefined {
  return asString(value) || undefined
}

function asTags(value: unknown): string[] {
  const tags = Array.isArray(value)
    ? value.map(asString)
    : asString(value).split(/[，,]/).map((tag) => tag.trim())

  return [...new Set(tags.filter(Boolean))]
}

function safeUrl(value: unknown): string | null {
  const candidate = asString(value)
  if (!candidate) return null

  try {
    const parsed = new URL(candidate)
    return SAFE_PROTOCOLS.has(parsed.protocol) ? parsed.toString() : null
  } catch {
    return null
  }
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

function accessStatus(row: UnknownRecord, rawUrl: string): Resource['accessStatus'] {
  const status = asString(row.url_status)
  if (status === 'blocked') return 'login_required'
  if (status === 'local') return 'local'
  if (rawUrl.toLocaleLowerCase().startsWith('mailto:')) return 'email'
  return 'direct'
}

export function adaptResource(input: unknown): Resource | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null

  const row = input as UnknownRecord
  const title = asString(row.title)
  const rawUrl = asString(row.url)
  const url = safeUrl(rawUrl)
  if (!title) return null

  const legacyCategory = (asString(row.legacy_category) || asString(row.category) || asString(row.category_name)).replaceAll('/', '-')
  const category = resolveCategory(
    legacyCategory,
    asString(row.category_id),
    asString(row.category_name),
  )
  const sourceLabel = asString(row.source_name) || asString(row.source) || '中国科学技术大学校园资源'
  const authority = asString(row.authority_label) || '校园资源'
  const summary = asString(row.summary) || asString(row.content) || FALLBACK_SUMMARY
  const tags = asTags(row.tags)
  const explicitId = asString(row.id)

  return {
    id: explicitId || `resource-${stableHash(`${url ?? asString(row.url)}|${title}`)}`,
    title,
    ...(url ? { url } : {}),
    category,
    legacyCategory,
    summary,
    content: optionalString(row.content),
    tags,
    source: {
      label: sourceLabel,
      authority,
      site: optionalString(row.source_site),
    },
    publishedAt: optionalString(row.published_at),
    updatedAt: optionalString(row.updated_at) || optionalString(row.crawled_at),
    cost: optionalString(row.cost),
    howTo: optionalString(row.how_to),
    accessType: optionalString(row.access_type),
    kind: optionalString(row.kind),
    relevanceScore: asWeight(row.weight, row.relevance_score),
    searchText: asString(row.search_text) || [
      title,
      legacyCategory,
      summary,
      optionalString(row.content),
      tags.join(' '),
      sourceLabel,
      optionalString(row.how_to),
      asTags(row.search_aliases).join(' '),
    ].filter(Boolean).join(' '),
    searchAliases: asTags(row.search_aliases),
    accessStatus: accessStatus(row, rawUrl),
    accessNote: optionalString(row.url_err),
    urlStatus: optionalString(row.url_status),
    urlHttp: optionalString(row.url_http),
    urlCheckedAt: optionalString(row.url_checked_at),
  }
}

export function adaptResourceCollection(input: unknown): Resource[] {
  const rows = Array.isArray(input)
    ? input
    : input && typeof input === 'object' && Array.isArray((input as UnknownRecord).articles)
      ? ((input as UnknownRecord).articles as unknown[])
      : []

  return rows.map(adaptResource).filter((resource): resource is Resource => resource !== null)
}
