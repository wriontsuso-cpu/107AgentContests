import { describe, expect, it, vi } from 'vitest'
import { requestAssistant } from './assistantClient'

describe('requestAssistant', () => {
  it('returns a local guided response when no API base URL is configured', async () => {
    const response = await requestAssistant({ message: '我想参加科创竞赛', history: [] }, { apiBaseUrl: '' })

    expect(response.reply).toContain('竞赛')
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
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: '找到一项资源', clarifications: [], resources: [], clues: ['学习与学术'] }),
    })
    const request = { message: '图书馆预约', history: [{ role: 'user' as const, content: '你好' }] }

    await requestAssistant(request, { apiBaseUrl: 'https://api.example.test/', fetcher: fetcher as typeof fetch })

    expect(fetcher).toHaveBeenCalledWith('https://api.example.test/api/assistant/chat', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(request),
    }))
  })
})
