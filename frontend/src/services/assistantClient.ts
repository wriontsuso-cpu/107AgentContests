import { loadLocalCatalog } from '@/data/localCatalog'
import smallTalkRules from '@/data/raw/assistantSmallTalk.json'
import type { Resource, ResourceAccessStatus } from '@/domain/resource'
import { getCategory, resolveCategory, RESOURCE_CATEGORIES, type ResourceCategoryId } from '@/domain/categories'
import { searchResources } from '@/lib/resourceSearch'

export interface AssistantHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AssistantRequest {
  message: string
  history: AssistantHistoryMessage[]
  category?: string
  sessionId?: string
  onProgress?: (update: AssistantProgressUpdate) => void
}

export interface AssistantProgressUpdate {
  stage: string
  message: string
}

export interface AssistantResource {
  id: string
  title: string
  summary: string
  category: string
  source: string
  url: string
  accessStatus?: ResourceAccessStatus
}

export interface AssistantResponse {
  status: 'clarify' | 'results' | 'no_answer' | 'conversation'
  reply: string
  clarifications: string[]
  resources: AssistantResource[]
  clues: string[]
  sessionId?: string
}

export type AssistantClient = (request: AssistantRequest) => Promise<AssistantResponse>

interface ClientOptions {
  apiBaseUrl?: string
  fetcher?: typeof fetch
  useMocks?: boolean
}

const DEFAULT_ASSISTANT_REQUEST_TIMEOUT_MS = 160_000

function configuredAssistantTimeout(): number {
  const configured = Number(import.meta.env.VITE_ASSISTANT_REQUEST_TIMEOUT_MS)
  return Number.isFinite(configured) && configured >= 10_000
    ? configured
    : DEFAULT_ASSISTANT_REQUEST_TIMEOUT_MS
}

function assistantRequestError(reason: unknown): Error {
  const reasonName = reason && typeof reason === 'object' && 'name' in reason
    ? String(reason.name)
    : ''
  if (['AbortError', 'TimeoutError'].includes(reasonName)) {
    return new Error('AI 回答等待超时，请重试；若持续发生，请检查模型服务或网页访问速度。')
  }
  if (reason instanceof Error && reason.message.startsWith('HTTP ')) {
    return new Error(`导航后端返回错误（${reason.message}），请稍后重试。`)
  }
  if (reason instanceof Error && reason.message === 'invalid response') {
    return new Error('导航后端返回的数据格式异常，请检查后端日志。')
  }
  return new Error('无法连接导航后端，请确认后端服务已启动。')
}

function inferCategory(message: string): ResourceCategoryId | undefined {
  const rules: [RegExp, ResourceCategoryId][] = [
    [/竞赛|比赛|科创|项目|实践/, 'competition'],
    [/科研|论文|实验室|学术/, 'research'],
    [/课程|教务|图书馆|学习|选课/, 'learning'],
    [/医院|心理|健康|资助|权益/, 'wellbeing'],
    [/社团|活动|讲座|二课/, 'community'],
    [/就业|实习|升学|留学|交流/, 'future'],
    [/办理|补办|财务|证明|安全/, 'services'],
    [/宿舍|网络|软件|迎新|生活/, 'life'],
  ]
  return rules.find(([pattern]) => pattern.test(message))?.[1]
}

function isWebUrl(value: string | undefined): value is string {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function toAssistantResource(resource: Resource): AssistantResource | undefined {
  if (!isWebUrl(resource.url)) return undefined
  return {
    id: resource.id,
    title: resource.title,
    summary: resource.summary,
    category: getCategory(resource.category).label,
    source: resource.source.authority || resource.source.label,
    url: resource.url,
    accessStatus: resource.accessStatus,
  }
}

function normalizeSmallTalk(message: string): string {
  return message.normalize('NFKC').toLowerCase().replace(/[\s\p{P}~]/gu, '')
}

const smallTalkReplies = new Map(smallTalkRules.flatMap((rule) => (
  rule.phrases.map((phrase) => [normalizeSmallTalk(phrase), rule.reply] as const)
)))

function smallTalkReply(message: string): string | undefined {
  return smallTalkReplies.get(normalizeSmallTalk(message))
}

async function localDemo(request: AssistantRequest): Promise<AssistantResponse> {
  const conversationalReply = smallTalkReply(request.message)
  if (conversationalReply !== undefined) {
    return {
      status: 'conversation',
      reply: conversationalReply,
      clarifications: [],
      resources: [],
      clues: [],
    }
  }

  const localResources = await loadLocalCatalog()
  const userHistory = request.history.filter((item) => item.role === 'user' && smallTalkReply(item.content) === undefined)
  const conversation = [...userHistory.map((item) => item.content), request.message].join(' ')
  const category = inferCategory(conversation)
  const categoryInfo = category ? getCategory(category) : undefined
  const matched = searchResources(localResources, { query: conversation, category })
  const fallback = category ? localResources.filter((resource) => resource.category === category) : localResources
  const recommendations = (matched.length > 0 ? matched : fallback)
    .map(toAssistantResource)
    .filter((item): item is AssistantResource => Boolean(item))
    .slice(0, 3)

  if (!categoryInfo) {
    return {
      status: 'clarify',
      reply: '我先帮你把范围缩小一点。你现在更接近学习、校园生活，还是想寻找课外机会？',
      clarifications: ['学习与课程支持', '校园生活与办事', '竞赛、科研或活动'],
      resources: [],
      clues: ['需求待细化'],
    }
  }

  const isFollowUp = userHistory.length > 0
  const isBroad = !isFollowUp && (request.message.length < 12 || /想|项目|机会|帮我/.test(request.message))
  return {
    status: isBroad ? 'clarify' : recommendations.length > 0 ? 'results' : 'no_answer',
    reply: isBroad
      ? `听起来你正在寻找“${categoryInfo.label}”方向的机会。为了推荐得更准，你可以继续告诉我偏好的时间、参与形式或目前阶段。`
      : `我按“${categoryInfo.label}”为你筛了一组更接近的校园入口，先从下面这些资源开始确认。`,
    clarifications: isBroad ? ['最近就能参加', '想先了解长期机会', '我有更具体的目标'] : [],
    resources: isBroad ? [] : recommendations,
    clues: [categoryInfo.label, isBroad ? '需求较宽泛' : '目标较明确'],
  }
}

type RemoteResult = Record<string, unknown>

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeUrl(value: string): string {
  return value.replace(/^http:/, 'https:').replace(/\/$/, '').toLowerCase()
}

function remoteAccessStatus(row: RemoteResult): ResourceAccessStatus {
  return asText(row.url_status) === 'blocked' ? 'login_required' : 'direct'
}

async function mapVerifiedResult(value: unknown, apiBaseUrl: string, fetcher: typeof fetch): Promise<AssistantResource | undefined> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const row = value as RemoteResult
  const candidateUrl = asText(row.url)
  const candidateTitle = asText(row.title)
  if (!candidateUrl && !candidateTitle) return undefined

  const explicitId = asText(row.id)
  const resultKind = asText(row.kind)
  const authorityLabel = asText(row.authority_label)
  const sourceSite = asText(row.source_site).toLowerCase()
  if (resultKind === 'web' && explicitId.startsWith('web-') && isWebUrl(candidateUrl)) {
    const candidateHost = new URL(candidateUrl).hostname.toLowerCase()
    const trustedLabels = new Set(['中国科大官方网页', '政府官方网页', '高校官方网页', '配置允许的可信网页'])
    const sourceMatches = sourceSite === candidateHost || candidateHost.endsWith(`.${sourceSite}`)
    if (!trustedLabels.has(authorityLabel) || !sourceSite || !sourceMatches) return undefined
    return {
      id: explicitId,
      title: candidateTitle || candidateHost,
      summary: asText(row.summary) || '来自后端核验过的可信网络来源。',
      category: '可信网络来源',
      source: authorityLabel,
      url: candidateUrl,
    }
  }

  const endpoint = explicitId
    ? `${apiBaseUrl}/api/resources/${encodeURIComponent(explicitId)}`
    : `${apiBaseUrl}/api/resources?q=${encodeURIComponent(candidateTitle)}&page=1&page_size=5`
  const verification = await fetcher(endpoint, { signal: AbortSignal.timeout(8_000) })
  if (!verification.ok) return undefined
  const payload: unknown = await verification.json()
  const candidates = explicitId
    ? [payload]
    : payload && typeof payload === 'object' && !Array.isArray(payload)
      ? ((payload as RemoteResult).items ?? (payload as RemoteResult).resources ?? [])
      : payload
  const verified = Array.isArray(candidates) ? candidates : [candidates]
  const match = verified
    .map((candidate) => candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? candidate as RemoteResult : undefined)
    .find((candidate) => candidate && (
      (candidateUrl && asText(candidate.url) && normalizeUrl(asText(candidate.url)) === normalizeUrl(candidateUrl))
      || (candidateTitle && asText(candidate.title) === candidateTitle)
    ))
  if (!match) return undefined
  const id = asText(match.id) || explicitId
  const verifiedUrl = asText(match.url)
  if (!id || !isWebUrl(verifiedUrl)) return undefined
  const category = getCategory(resolveCategory(asText(match.category), asText(match.category_id), asText(match.category_name))).label
  const sourceValue = match.source
  const source = sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)
    ? asText((sourceValue as RemoteResult).authority) || asText((sourceValue as RemoteResult).label)
    : asText(sourceValue) || asText(match.authority) || '中国科学技术大学'
  return {
    id,
    title: asText(match.title) || candidateTitle,
    summary: asText(match.summary) || '暂无简介，请查看资源详情。',
    category,
    source,
    url: verifiedUrl,
    accessStatus: remoteAccessStatus(match),
  }
}

function searchRequestBody(request: AssistantRequest): string {
  return JSON.stringify({
    query: request.message,
    top_k: 5,
    category: request.category ?? null,
    session_id: request.sessionId,
    history: request.history.slice(-40),
  })
}

async function readStreamingPayload(
  response: Response,
  onProgress: (update: AssistantProgressUpdate) => void,
): Promise<unknown> {
  if (!response.body) throw new Error('invalid response')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: unknown

  const consumeLine = (line: string) => {
    if (!line.trim()) return
    const event: unknown = JSON.parse(line)
    if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('invalid response')
    const row = event as RemoteResult
    if (row.type === 'progress') {
      const stage = asText(row.stage)
      const message = asText(row.message)
      if (stage && message) onProgress({ stage, message })
      return
    }
    if (row.type === 'result') {
      result = row.data
      return
    }
    if (row.type === 'error') {
      const status = Number(row.status)
      throw new Error(Number.isFinite(status) ? `HTTP ${status}` : asText(row.message) || 'stream error')
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) consumeLine(line)
    if (done) break
  }
  consumeLine(buffer)
  if (result === undefined) throw new Error('invalid response')
  return result
}

async function mapRemotePayload(
  payload: unknown,
  apiBaseUrl: string,
  fetcher: typeof fetch,
  request: AssistantRequest,
): Promise<AssistantResponse> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid response')
  const row = payload as RemoteResult
  const remoteResults = Array.isArray(row.results) ? row.results : []
  const verificationResults = await Promise.allSettled(remoteResults.map((item) => mapVerifiedResult(
    item,
    apiBaseUrl,
    fetcher,
  )))
  const verifiedResources = verificationResults
    .filter((result): result is PromiseFulfilledResult<AssistantResource | undefined> => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((item): item is AssistantResource => Boolean(item))
  const clarifications = Array.isArray(row.clarifications) ? row.clarifications.map(asText).filter(Boolean) : []
  const reply = asText(row.answer) || (verifiedResources.length > 0
    ? '我找到了几项可核验的校园资源。'
    : '暂时没有找到可核验的资源，请换一种说法再试。')
  return {
    status: clarifications.length > 0 ? 'clarify' : verifiedResources.length > 0 ? 'results'
      : row.response_type === 'conversation' && asText(row.answer) ? 'conversation' : 'no_answer',
    reply,
    clarifications,
    resources: verifiedResources,
    clues: request.category ? [request.category] : [],
    sessionId: asText(row.session_id) || undefined,
  }
}

export async function requestAssistant(request: AssistantRequest, options: ClientOptions = {}): Promise<AssistantResponse> {
  const apiBaseUrl = options.apiBaseUrl ?? import.meta.env.VITE_API_BASE_URL ?? ''
  const useMocks = options.useMocks ?? (import.meta.env.VITE_USE_MOCKS === 'true' || !apiBaseUrl)
  if (useMocks) return localDemo(request)

  const fetcher = options.fetcher ?? fetch
  const normalizedBaseUrl = apiBaseUrl.replace(/\/$/, '')
  const headers = { 'Content-Type': 'application/json' }
  const body = searchRequestBody(request)
  try {
    let response = await fetcher(`${normalizedBaseUrl}${request.onProgress ? '/api/search/stream' : '/api/search'}`, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(configuredAssistantTimeout()),
    })
    if (request.onProgress && [404, 405].includes(response.status)) {
      response = await fetcher(`${normalizedBaseUrl}/api/search`, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(configuredAssistantTimeout()),
      })
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const isStreamingResponse = request.onProgress && response.headers?.get('content-type')?.includes('application/x-ndjson')
    const payload = isStreamingResponse
      ? await readStreamingPayload(response, request.onProgress!)
      : await response.json()
    return await mapRemotePayload(payload, normalizedBaseUrl, fetcher, request)
  } catch (reason) {
    throw assistantRequestError(reason)
  }
}

export async function closeAssistantSession(sessionId: string, options: ClientOptions = {}): Promise<void> {
  const apiBaseUrl = options.apiBaseUrl ?? import.meta.env.VITE_API_BASE_URL ?? ''
  const useMocks = options.useMocks ?? (import.meta.env.VITE_USE_MOCKS === 'true' || !apiBaseUrl)
  if (useMocks || !sessionId) return

  const response = await (options.fetcher ?? fetch)(
    `${apiBaseUrl.replace(/\/$/, '')}/api/sessions/${encodeURIComponent(sessionId)}/exit`,
    {
      method: 'POST',
      signal: AbortSignal.timeout(8_000),
    },
  )
  if (!response.ok && response.status !== 404) {
    throw new Error('会话暂时无法关闭。')
  }
}

export const assistantStarterPrompts = RESOURCE_CATEGORIES.slice(0, 6).map((category) => category.prompt)
