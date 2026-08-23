import { describe, expect, it } from 'vitest'
import { adaptResource, adaptResourceCollection } from './resourceAdapter'

describe('adaptResource', () => {
  it('generates a stable id when crawler data has no id', () => {
    const row = { title: '教务系统', url: 'https://jw.ustc.edu.cn/', category: '资源导航' }

    const first = adaptResource(row)
    const second = adaptResource({ ...row })

    expect(first?.id).toMatch(/^resource-/)
    expect(second?.id).toBe(first?.id)
  })

  it('preserves an explicit id from the future API shape', () => {
    const resource = adaptResource({
      id: '3d3bd6dc-6db7-4a2e-b2e6-2da780c1b247',
      title: '学习空间预约',
      url: 'https://lib.ustc.edu.cn/',
      category_id: 'academic',
      category_name: '学习与学术',
    })

    expect(resource?.id).toBe('3d3bd6dc-6db7-4a2e-b2e6-2da780c1b247')
    expect(resource?.category).toBe('learning')
  })

  it.each([
    ['办事指南', 'services'],
    ['教务通知', 'learning'],
    ['学术科研', 'research'],
    ['竞赛/科创', 'competition'],
    ['校园活动', 'community'],
    ['新生指南', 'life'],
    ['校医院', 'wellbeing'],
    ['留学/国际交流', 'future'],
  ])('maps legacy category %s into %s', (legacyCategory, expectedCategory) => {
    const resource = adaptResource({
      title: `${legacyCategory}示例`,
      url: `https://www.ustc.edu.cn/${encodeURIComponent(legacyCategory)}`,
      category: legacyCategory,
    })

    expect(resource?.category).toBe(expectedCategory)
  })

  it('normalizes optional values without showing empty metadata', () => {
    const resource = adaptResource({
      title: '网络教学平台',
      url: 'https://course.ustc.edu.cn/portal',
      category: '资源导航',
      tags: '课程, 教学',
      published_at: '',
    })

    expect(resource).toMatchObject({
      summary: '访问资源原页面，查看最新说明与办理方式。',
      tags: ['课程', '教学'],
      publishedAt: undefined,
      source: { label: '中国科学技术大学校园资源', authority: '校园资源' },
    })
  })

  it('drops malformed rows and unsafe destinations', () => {
    expect(adaptResource({ category: '办事指南' })).toBeNull()
    expect(adaptResource({ title: '危险链接', url: 'javascript:alert(1)' })).toBeNull()
    expect(adaptResource({ title: '本地文件', url: 'file:///C:/secret.txt' })).toBeNull()
  })
})

describe('adaptResourceCollection', () => {
  it('accepts both a raw array and the crawler envelope', () => {
    const row = { title: '图书馆', url: 'https://lib.ustc.edu.cn/', category: '图书馆' }

    expect(adaptResourceCollection([row])).toHaveLength(1)
    expect(adaptResourceCollection({ articles: [row], total: 1 })).toHaveLength(1)
  })
})
