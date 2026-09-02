import rankingConfig from '@/data/raw/searchRanking.json'
import { CATEGORY_IDS, type ResourceCategoryId } from '@/domain/categories'
import type { Resource } from '@/domain/resource'

export interface ResourceFilters {
  query?: string
  category?: ResourceCategoryId
  legacyCategory?: string
  tag?: string
}

const WEIGHT_SCALE = 8
const STOPWORDS = new Set(rankingConfig.stopwords)
const KEYWORDS = [...rankingConfig.keywords].sort((left, right) => right.length - left.length)
const SYNONYMS = Object.entries(rankingConfig.synonyms)
const PINYIN = Object.entries(rankingConfig.pinyin)

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('zh-CN').replace(/\s+/g, ' ')
}

function isAscii(value: string): boolean {
  return [...value].every((character) => character.charCodeAt(0) <= 127)
}

function levenshtein(left: string, right: string, maxDist: number): number {
  if (left === right) return 0
  if (Math.abs(left.length - right.length) > maxDist) return maxDist + 1
  if (!left) return right.length
  if (!right) return left.length

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i]
    let rowMin = i
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      const value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
      current.push(value)
      if (value < rowMin) rowMin = value
    }
    if (rowMin > maxDist) return maxDist + 1
    previous = current
  }
  return previous[right.length]
}

function windowDistance(haystack: string, needle: string, maxDist: number): number {
  if (!needle) return 0
  if (haystack.includes(needle)) return 0
  if (haystack.length <= needle.length + maxDist) return levenshtein(haystack, needle, maxDist)

  const minLen = Math.max(1, needle.length - maxDist)
  const maxLen = needle.length + maxDist
  let best = maxDist + 1
  for (let length = minLen; length <= maxLen; length += 1) {
    for (let index = 0; index + length <= haystack.length; index += 1) {
      const distance = levenshtein(haystack.slice(index, index + length), needle, maxDist)
      if (distance < best) best = distance
      if (best === 0) return 0
    }
  }
  return best
}

function hasEnoughSharedCharacters(field: string, token: string, maxDist: number): boolean {
  const unique = new Set(token)
  let shared = 0
  for (const character of unique) {
    if (field.includes(character)) shared += 1
  }
  return shared >= Math.max(1, unique.size - maxDist)
}

function fieldMatchRatio(field: string, token: string, allowFuzzy = false): number {
  if (!field || !token) return 0
  if (field === token) return 1
  if (field.startsWith(token)) return 0.92
  if (field.includes(token)) return 0.84
  if (!allowFuzzy || token.length < 3 || field.length > 40) return 0

  const maxDist = token.length <= 7 ? 1 : 2
  if (!hasEnoughSharedCharacters(field, token, maxDist)) return 0
  const distance = windowDistance(field, token, maxDist)
  if (distance <= maxDist) return Math.max(0.48, 0.8 - distance * 0.16)
  return 0
}

function expandQuery(query: string): string {
  let expanded = query
  for (const [source, targets] of SYNONYMS) {
    if (expanded.includes(source)) expanded += ` ${targets.join(' ')}`
  }
  for (const [pinyin, chinese] of PINYIN) {
    if (expanded.includes(pinyin.toLocaleLowerCase('zh-CN'))) expanded += ` ${chinese}`
  }
  return expanded
}

function stripStopwords(value: string): string {
  const ordered = [...STOPWORDS].sort((left, right) => right.length - left.length)
  let text = value
  for (const stop of ordered) {
    text = text.replaceAll(stop, ' ')
  }
  return text.replace(/\s+/g, ' ').trim()
}

function segmentChinese(run: string): string[] {
  const parts: string[] = []
  let index = 0
  while (index < run.length) {
    const keyword = KEYWORDS.find((item) => run.startsWith(item, index))
    if (keyword) {
      parts.push(keyword)
      index += keyword.length
      continue
    }

    let cursor = index + 1
    while (cursor < run.length && !KEYWORDS.some((item) => run.startsWith(item, cursor))) cursor += 1
    const chunk = run.slice(index, cursor)
    if (chunk.length >= 2) parts.push(chunk)
    else if (run.length === 1) parts.push(chunk)
    index = cursor
  }
  return parts
}

export function tokenizeQuery(query: string): { full: string; terms: string[] } {
  const full = normalized(query)
  if (!full) return { full, terms: [] }

  const expanded = stripStopwords(normalized(expandQuery(full)))
  const terms = new Set<string>([full])

  for (const word of expanded.match(/[a-z0-9]+/g) ?? []) {
    if (word.length >= 2) terms.add(word)
  }
  for (const run of expanded.match(/[\u4e00-\u9fff]+/g) ?? []) {
    for (const part of segmentChinese(run)) terms.add(part)
  }
  for (const part of expanded.split(/[\s,，、;；/]+/)) {
    const token = part.trim()
    if (token.length >= 2 && !STOPWORDS.has(token)) terms.add(token)
  }

  return { full, terms: [...terms] }
}

function scoreAgainstFields(fields: readonly [string, number, boolean][], token: string): number {
  let best = 0
  for (const [field, weight, allowFuzzy] of fields) {
    const ratio = fieldMatchRatio(field, token, allowFuzzy)
    if (ratio > 0) best = Math.max(best, ratio * weight)
  }
  return best
}

function scoreResource(resource: Resource, full: string, terms: readonly string[]): number {
  if (!full) return 0

  const title = normalized(resource.title)
  const tags = resource.tags.map(normalized)
  const summary = normalized(resource.summary)
  const searchText = normalized(resource.searchText)
  const category = normalized(`${resource.legacyCategory} ${resource.category}`)
  const source = normalized(`${resource.source.label} ${resource.source.authority}`)
  const fields: [string, number, boolean][] = [
    [title, 100, true],
    ...(resource.searchAliases ?? []).map((alias): [string, number, boolean] => [
      normalized(alias),
      isAscii(alias) ? 92 : 58,
      false,
    ]),
    [tags.join(' '), 58, false],
    [category, 44, false],
    [source, 32, false],
    [summary, 20, false],
    [searchText, 12, false],
  ]

  const fullScore = scoreAgainstFields(fields, full) * 10
  const extraTerms = terms.filter((term) => term !== full)
  const scoringTerms = extraTerms.length > 0 ? extraTerms : terms

  let termScore = 0
  let matchedTerms = 0
  for (const term of scoringTerms) {
    const lengthBonus = Math.min(Math.max(term.length, 2), 6) / 3
    const value = scoreAgainstFields(fields, term) * lengthBonus
    if (value > 0) {
      matchedTerms += 1
      termScore += value
    }
  }

  const coverage = scoringTerms.length > 0 ? matchedTerms / scoringTerms.length : 0
  const hasStrongMatch = fullScore >= 280 || termScore >= 70
  const hasCoveredMatch = coverage >= 0.5 && termScore > 0
  if (!hasStrongMatch && !hasCoveredMatch && fullScore <= 0) return -1

  return fullScore + termScore * (0.45 + 0.55 * coverage) + resource.relevanceScore * WEIGHT_SCALE
}

export function searchResources(source: readonly Resource[], filters: ResourceFilters): Resource[] {
  const { full, terms } = tokenizeQuery(filters.query ?? '')

  return source
    .map((resource, index) => ({
      resource,
      index,
      score: full ? scoreResource(resource, full, terms) : resource.relevanceScore,
    }))
    .filter(({ resource, score }) => {
      const categoryMatches = !filters.category || resource.category === filters.category
      const legacyMatches = !filters.legacyCategory || resource.legacyCategory === filters.legacyCategory
      const tagMatches = !filters.tag || resource.tags.includes(filters.tag)
      const queryMatches = !full || score >= 0
      return categoryMatches && legacyMatches && tagMatches && queryMatches
    })
    .sort((left, right) => {
      const scoreDelta = right.score - left.score
      if (scoreDelta !== 0) return scoreDelta
      return left.index - right.index
    })
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

export function parseResourceFilters(params: URLSearchParams): { query: string; category?: ResourceCategoryId; legacyCategory?: string; tag?: string; page: number } {
  const query = params.get('q')?.trim() ?? ''
  const categoryValue = params.get('category')
  const category = CATEGORY_IDS.find((id) => id === categoryValue)
  const rawPage = Number.parseInt(params.get('page') ?? '1', 10)
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  const legacyCategory = params.get('group')?.trim() || undefined
  const tag = params.get('tag')?.trim() || undefined

  return { query, ...(category ? { category } : {}), ...(legacyCategory ? { legacyCategory } : {}), ...(tag ? { tag } : {}), page }
}
