import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadLocalCatalog } from './localCatalog'
import { searchResources } from '@/lib/resourceSearch'
import { resourceCounts, totalResourceCount } from './catalogMetadata'

describe('loadLocalCatalog', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('keeps the complete catalog available in production builds', async () => {
    vi.stubEnv('DEV', false)

    const resources = await loadLocalCatalog()

    expect(resources).toHaveLength(totalResourceCount)
  }, 15_000)

  it('keeps core campus queries usable across the complete catalog', async () => {
    const resources = await loadLocalCatalog()
    const expectations = [
      ['邮箱', '邮箱'],
      ['校园卡', '校园卡服务申请'],
      ['图书馆', '图书馆讲座/活动与数据库动态'],
      ['图书管', '图书馆讲座/活动与数据库动态'],
      ['我想预约图书馆座位', '学习空间预约'],
      ['新生入学', '迎新 · 九 | 本科新生入学须知'],
      ['科研项目', '科研项目结题申报系统'],
      ['jwxt', '教务系统'],
      ['matlab', '正版软件'],
    ] as const

    for (const [query, expectedTitle] of expectations) {
      const startedAt = performance.now()
      const results = searchResources(resources, { query })
      const elapsed = performance.now() - startedAt
      expect(results[0]?.title).toBe(expectedTitle)
      expect(elapsed).toBeLessThan(3_000)
    }
  }, 30_000)

  it('maps every displayable resource into a resource hall category', async () => {
    const resources = await loadLocalCatalog()
    expect(resources.filter((resource) => resource.category === 'other')).toEqual([])
  }, 15_000)

  it('keeps generated sidebar counts aligned with the published catalog', async () => {
    const resources = await loadLocalCatalog()
    const actualCounts = Object.fromEntries(
      Object.keys(resourceCounts).map((category) => [
        category,
        resources.filter((resource) => resource.category === category).length,
      ]),
    )

    expect(totalResourceCount).toBe(resources.length)
    expect(Object.values(resourceCounts).reduce((sum, count) => sum + count, 0)).toBe(resources.length)
    expect(actualCounts).toEqual(resourceCounts)
  }, 15_000)
})
