import { describe, expect, it, vi } from 'vitest'
import { getResourceById, listResources } from './resourceClient'

describe('resourceClient', () => {
  it('uses the local catalog when mock mode is enabled', async () => {
    const result = await listResources({ query: '图书馆', page: 1, pageSize: 5 }, { useMocks: true })
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items.length).toBeLessThanOrEqual(5)
  })

  it('loads the complete development catalog for a real secondary category', async () => {
    const result = await listResources(
      { category: 'services', legacyCategory: '学工通知', page: 1, pageSize: 12 },
      { useMocks: true },
    )

    expect(result.total).toBeGreaterThan(0)
    expect(result.items.every((resource) => resource.legacyCategory === '学工通知')).toBe(true)
  })

  it('serializes the agreed browser API query and adapts its results', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ id: 'remote-1', title: '远端资源', url: 'https://www.ustc.edu.cn/', category: '办事指南' }],
        total: 1,
        page: 2,
        page_size: 10,
      }),
    })

    const result = await listResources(
      { query: '证明', category: 'services', legacyCategory: '办事指南', tag: '本科生', page: 2, pageSize: 10 },
      { apiBaseUrl: 'https://api.example.test/', useMocks: false, fetcher: fetcher as typeof fetch },
    )

    expect(fetcher.mock.calls[0][0]).toContain('/api/resources?q=%E8%AF%81%E6%98%8E&category=services&group=%E5%8A%9E%E4%BA%8B%E6%8C%87%E5%8D%97&tag=%E6%9C%AC%E7%A7%91%E7%94%9F&page=2&page_size=10')
    expect(result.items[0]).toMatchObject({ id: 'remote-1', category: 'services' })
  })

  it('treats a remote 404 as a missing resource', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 404 })
    await expect(getResourceById('missing', { apiBaseUrl: 'https://api.example.test', useMocks: false, fetcher: fetcher as typeof fetch })).resolves.toBeUndefined()
  })
})
