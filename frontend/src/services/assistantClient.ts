import { resources } from '@/data/resources'
import { getCategory, RESOURCE_CATEGORIES, type ResourceCategoryId } from '@/domain/categories'
import { searchResources } from '@/lib/resourceSearch'

export interface AssistantHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AssistantRequest {
  message: string
  history: AssistantHistoryMessage[]
}

export interface AssistantResource {
  id: string
  title: string
  summary: string
  category: string
  url: string
}

export interface AssistantResponse {
  reply: string
  clarifications: string[]
  resources: AssistantResource[]
  clues: string[]
}

export type AssistantClient = (request: AssistantRequest) => Promise<AssistantResponse>

interface ClientOptions {
  apiBaseUrl?: string
  fetcher?: typeof fetch
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

function toAssistantResource(resource: (typeof resources)[number]): AssistantResource {
  return {
    id: resource.id,
    title: resource.title,
    summary: resource.summary,
    category: getCategory(resource.category).label,
    url: `/resources/${resource.id}`,
  }
}

function localDemo(request: AssistantRequest): AssistantResponse {
  const category = inferCategory(request.message)
  const categoryInfo = category ? getCategory(category) : undefined
  const matched = searchResources(resources, { query: request.message, category })
  const fallback = category ? resources.filter((resource) => resource.category === category) : resources
  const recommendations = (matched.length > 0 ? matched : fallback).slice(0, 3).map(toAssistantResource)

  if (!categoryInfo) {
    return {
      reply: '我先帮你把范围缩小一点。你现在更接近学习、校园生活，还是想寻找课外机会？',
      clarifications: ['学习与课程支持', '校园生活与办事', '竞赛、科研或活动'],
      resources: [],
      clues: ['需求待细化'],
    }
  }

  const isBroad = request.message.length < 12 || /想|项目|机会|帮我/.test(request.message)
  return {
    reply: isBroad
      ? `听起来你正在寻找“${categoryInfo.label}”方向的机会。为了推荐得更准，你可以继续告诉我偏好的时间、参与形式或目前阶段。`
      : `我按“${categoryInfo.label}”为你筛了一组更接近的校园入口，先从下面这些资源开始确认。`,
    clarifications: isBroad ? ['最近就能参加', '想先了解长期机会', '我有更具体的目标'] : [],
    resources: recommendations,
    clues: [categoryInfo.label, isBroad ? '需求较宽泛' : '目标较明确'],
  }
}

export async function requestAssistant(request: AssistantRequest, options: ClientOptions = {}): Promise<AssistantResponse> {
  const apiBaseUrl = options.apiBaseUrl ?? import.meta.env.VITE_API_BASE_URL ?? ''
  if (!apiBaseUrl) return localDemo(request)

  const fetcher = options.fetcher ?? fetch
  try {
    const response = await fetcher(`${apiBaseUrl.replace(/\/$/, '')}/api/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(12_000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json() as AssistantResponse
  } catch {
    throw new Error('导航服务暂时不可用，请稍后重试。')
  }
}

export const assistantStarterPrompts = RESOURCE_CATEGORIES.slice(0, 6).map((category) => category.prompt)
