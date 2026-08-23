import { describe, expect, it, vi } from 'vitest'
import { requestAssistant } from './assistantClient'

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
    expect(response.clues).toContain('竞赛与实践')
  })

  it('normalizes remote errors for the UI', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 503 })

    await expect(requestAssistant(
      { message: '图书馆预约', history: [] },
      { apiBaseUrl: 'https://api.example.test', fetcher: fetcher as typeof fetch },
    )).rejects.toThrow('导航服务暂时不可用')
  })

  it('passes the agreed request contract to a configured endpoint', async () => {
    const known = (await import('@/data/resources')).resources.find((resource) => resource.url)!
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ answer: '找到一项资源', results: [{ title: known.title, url: known.url, category: known.legacyCategory, summary: known.summary }], session_id: 's-1' }),
    })
    const request = { message: '图书馆预约', history: [{ role: 'user' as const, content: '你好' }] }

    await requestAssistant(request, { apiBaseUrl: 'https://api.example.test/', fetcher: fetcher as typeof fetch })

    expect(fetcher).toHaveBeenCalledWith('https://api.example.test/api/search', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ query: request.message, top_k: 5, category: null, session_id: undefined }),
    }))
    const response = await requestAssistant(request, { apiBaseUrl: 'https://api.example.test/', fetcher: fetcher as typeof fetch })
    expect(response.resources[0].path).toBe(`/resources/${known.id}`)
    expect(response.sessionId).toBe('s-1')
  })

  it('never exposes a model supplied unknown URL as a clickable recommendation', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ answer: '试试这个', results: [{ title: '伪造入口', url: 'https://evil.example/phish', category: '图书馆' }] }),
    })

    const response = await requestAssistant(
      { message: '找资源', history: [] },
      { apiBaseUrl: 'https://api.example.test', fetcher: fetcher as typeof fetch },
    )

    expect(response.resources).toEqual([])
  })
})
