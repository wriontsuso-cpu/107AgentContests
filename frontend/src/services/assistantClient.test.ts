import { describe, expect, it, vi } from 'vitest'
import { closeAssistantSession, requestAssistant } from './assistantClient'

describe('requestAssistant', () => {
  it('returns a local guided response when no API base URL is configured', async () => {
    const first = await requestAssistant({ message: '我想参加科创竞赛', history: [] }, { apiBaseUrl: '' })
    expect(first.status).toBe('clarify')
    expect(first.resources).toEqual([])

    const response = await requestAssistant({
      message: '最近就能参加',
      history: [{ role: 'user', content: '我想参加科创竞赛' }, { role: 'assistant', content: first.reply }],
    }, { apiBaseUrl: '' })

    expect(response.reply).toContain('竞赛')
    expect(response.status).toBe('results')
    expect(response.resources.length).toBeGreaterThan(0)
    expect(response.resources[0].url).toMatch(/^https?:\/\//)
    expect(response.resources[0].source).not.toBe('')
    expect(response.clues).toContain('竞赛与实践')
  })

  it('normalizes remote errors for the UI', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 503 })

    await expect(requestAssistant(
      { message: '图书馆预约', history: [] },
      { apiBaseUrl: 'https://api.example.test', fetcher: fetcher as typeof fetch },
    )).rejects.toThrow('HTTP 503')
  })

  it('gives the main assistant request a 160 second timeout', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 503 })

    await expect(requestAssistant(
      { message: '图书馆预约', history: [] },
      { apiBaseUrl: 'https://api.example.test', fetcher: fetcher as typeof fetch },
    )).rejects.toThrow('HTTP 503')

    expect(timeout).toHaveBeenCalledWith(160_000)
    timeout.mockRestore()
  })

  it('distinguishes a main request timeout from a missing backend', async () => {
    const fetcher = vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError'))

    await expect(requestAssistant(
      { message: '图书馆预约', history: [] },
      { apiBaseUrl: 'https://api.example.test', fetcher: fetcher as typeof fetch },
    )).rejects.toThrow('AI 回答等待超时')
  })

  it('keeps the answer when one resource verification request fails', async () => {
    const remoteResource = { id: 'resource-1', title: '图书馆预约', url: 'https://lib.ustc.edu.cn/space' }
    const fetcher = vi.fn().mockImplementation(async (input: string | URL | Request) => {
      if (String(input).endsWith('/api/search')) {
        return {
          ok: true,
          json: async () => ({ answer: '可通过图书馆入口预约。', results: [remoteResource] }),
        }
      }
      throw new DOMException('timed out', 'TimeoutError')
    })

    const response = await requestAssistant(
      { message: '图书馆预约', history: [] },
      { apiBaseUrl: 'https://api.example.test', fetcher: fetcher as typeof fetch },
    )

    expect(response.reply).toBe('可通过图书馆入口预约。')
    expect(response.resources).toEqual([])
  })

  it('passes the agreed request contract to a configured endpoint', async () => {
    const remoteResource = { id: 'full-catalog-1295', title: '完整目录资源', url: 'https://full.ustc.edu.cn/resource', category: '学术科研', summary: '来自后端完整目录', url_status: 'blocked' }
    const fetcher = vi.fn().mockImplementation(async (input: string | URL | Request) => ({
      ok: true,
      json: async () => String(input).endsWith('/api/search')
        ? { answer: '找到一项资源', results: [remoteResource], session_id: 's-1' }
        : remoteResource,
    }))
    const request = { message: '图书馆预约', history: [{ role: 'user' as const, content: '你好' }] }

    const response = await requestAssistant(request, { apiBaseUrl: 'https://api.example.test/', fetcher: fetcher as typeof fetch })

    expect(fetcher).toHaveBeenCalledWith('https://api.example.test/api/search', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ query: request.message, top_k: 5, category: null, session_id: undefined, history: request.history }),
    }))
    expect(fetcher).toHaveBeenCalledWith('https://api.example.test/api/resources/full-catalog-1295', expect.any(Object))
    expect(response.resources[0].url).toBe('https://full.ustc.edu.cn/resource')
    expect(response.resources[0].source).toBeTruthy()
    expect(response.resources[0].accessStatus).toBe('login_required')
    expect(response.sessionId).toBe('s-1')
  })

  it('never exposes a model supplied unknown URL as a clickable recommendation', async () => {
    const fetcher = vi.fn().mockImplementation(async (input: string | URL | Request) => ({
      ok: true,
      json: async () => String(input).endsWith('/api/search')
        ? { answer: '试试这个', results: [{ title: '伪造入口', url: 'https://evil.example/phish', category: '图书馆' }] }
        : { items: [] },
    }))

    const response = await requestAssistant(
      { message: '找资源', history: [] },
      { apiBaseUrl: 'https://api.example.test', fetcher: fetcher as typeof fetch },
    )

    expect(response.resources).toEqual([])
  })

  it('shows a network source only after backend trust metadata is present', async () => {
    const trustedWebResult = {
      id: 'web-official-source',
      title: '中国科大官方通知',
      url: 'https://www.ustc.edu.cn/notice',
      category: '可信网络来源',
      summary: '联网核验后的页面摘要',
      source_site: 'www.ustc.edu.cn',
      authority_label: '中国科大官方网页',
      kind: 'web',
    }
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ answer: '依据中国科大官方页面回答。', results: [trustedWebResult] }),
    })

    const response = await requestAssistant(
      { message: '查询最新官方通知', history: [] },
      { apiBaseUrl: 'https://api.example.test', fetcher: fetcher as typeof fetch },
    )

    expect(response.resources).toEqual([expect.objectContaining({
      title: '中国科大官方通知',
      url: 'https://www.ustc.edu.cn/notice',
      source: '中国科大官方网页',
    })])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('closes the active backend session when the conversation is reset', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200 })

    await closeAssistantSession('s-1', {
      apiBaseUrl: 'https://api.example.test/',
      useMocks: false,
      fetcher: fetcher as typeof fetch,
    })

    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example.test/api/sessions/s-1/exit',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
