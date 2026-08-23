import { describe, expect, it } from 'vitest'
import type { Resource } from '@/domain/resource'
import { paginateResources, parseResourceFilters, searchResources } from './resourceSearch'

const base: Omit<Resource, 'id' | 'title' | 'summary' | 'tags' | 'searchText'> = {
  url: 'https://www.ustc.edu.cn/',
  category: 'learning',
  legacyCategory: '图书馆',
  source: { label: '图书馆', authority: '职能部门官方' },
  relevanceScore: 0,
}

const fixtures: Resource[] = [
  { ...base, id: '1', title: '学习空间预约', summary: '预约图书馆研修间', tags: ['图书馆'], searchText: '学习空间预约 图书馆研修间' },
  { ...base, id: '2', title: '图书馆', summary: '馆藏与借阅服务', tags: ['学习空间预约'], searchText: '图书馆 馆藏 借阅' },
  { ...base, id: '3', title: '网络教学平台', summary: '课程与作业', tags: ['课程'], searchText: '网络教学平台 课程 作业' },
  { ...base, id: '4', title: '学习空间预约指南', summary: '操作指南', tags: [], searchText: '学习空间预约指南' },
  { ...base, id: '5', title: '校医院', summary: '医疗服务', tags: [], searchText: '校医院 医疗', category: 'wellbeing' },
]

describe('searchResources', () => {
  it('ranks exact title, title match, tag match, then body match', () => {
    const result = searchResources(fixtures, { query: '学习空间预约' })

    expect(result.map((resource) => resource.id)).toEqual(['1', '4', '2'])
  })

  it('filters by category and leaves source data untouched', () => {
    const copy = [...fixtures]

    expect(searchResources(fixtures, { category: 'wellbeing' }).map((resource) => resource.id)).toEqual(['5'])
    expect(fixtures).toEqual(copy)
  })

  it('filters by source subcategory and tag together', () => {
    const result = searchResources(fixtures, {
      category: 'learning',
      legacyCategory: '图书馆',
      tag: '图书馆',
    })

    expect(result.map((resource) => resource.id)).toEqual(['1'])
  })

  it('returns a stable useful order for blank queries', () => {
    const result = searchResources(fixtures, {})
    expect(result.map((resource) => resource.id)).toEqual(fixtures.map((resource) => resource.id))
  })
})

describe('pagination and URL filters', () => {
  it('paginates without rendering the whole collection', () => {
    const page = paginateResources(fixtures, 2, 2)
    expect(page.items.map((resource) => resource.id)).toEqual(['3', '4'])
    expect(page.totalPages).toBe(3)
  })

  it('accepts only known categories and positive pages', () => {
    expect(parseResourceFilters(new URLSearchParams('q=%E5%9B%BE%E4%B9%A6%E9%A6%86&category=learning&group=%E5%9B%BE%E4%B9%A6%E9%A6%86&tag=%E9%A2%84%E7%BA%A6&page=2'))).toEqual({
      query: '图书馆',
      category: 'learning',
      legacyCategory: '图书馆',
      tag: '预约',
      page: 2,
    })
    expect(parseResourceFilters(new URLSearchParams('category=unknown&page=-7'))).toEqual({ query: '', page: 1 })
  })
})
