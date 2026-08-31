import { describe, expect, it } from 'vitest'
import type { Resource } from '@/domain/resource'
import { paginateResources, parseResourceFilters, searchResources, tokenizeQuery } from './resourceSearch'

const base: Omit<Resource, 'id' | 'title' | 'summary' | 'tags' | 'searchText' | 'relevanceScore'> = {
  url: 'https://www.ustc.edu.cn/',
  category: 'learning',
  legacyCategory: '图书馆',
  source: { label: '图书馆', authority: '职能部门官方' },
}

const fixtures: Resource[] = [
  { ...base, id: '1', title: '学习空间预约', summary: '预约图书馆研修间', tags: ['图书馆'], searchText: '学习空间预约 图书馆研修间 座位 占座', relevanceScore: 9 },
  { ...base, id: '2', title: '图书馆', summary: '馆藏与借阅服务', tags: ['学习空间预约'], searchText: '图书馆 馆藏 借阅', relevanceScore: 8 },
  { ...base, id: '3', title: '网络教学平台', summary: '课程与作业', tags: ['课程'], searchText: '网络教学平台 课程 作业', relevanceScore: 7 },
  { ...base, id: '4', title: '学习空间预约指南', summary: '操作指南', tags: [], searchText: '学习空间预约指南', relevanceScore: 3 },
  { ...base, id: '5', title: '校医院', summary: '医疗服务', tags: [], searchText: '校医院 医疗', category: 'wellbeing', relevanceScore: 8 },
  { ...base, id: '6', title: '校园活动报道', summary: '某学院举行晚会', tags: ['活动'], searchText: '晚会 报道', category: 'community', relevanceScore: 1 },
]

describe('tokenizeQuery', () => {
  it('drops filler words and expands campus synonyms', () => {
    const tokens = tokenizeQuery('怎么预约图书馆座位')
    expect(tokens.terms).toEqual(expect.arrayContaining(['预约', '图书馆', '学习空间', '座位']))
  })

  it('maps common pinyin onto Chinese service names', () => {
    expect(tokenizeQuery('tushuguan').terms).toContain('图书馆')
  })
})

describe('searchResources', () => {
  it('ranks exact title, title match, tag match, then body match', () => {
    const result = searchResources(fixtures, { query: '学习空间预约' })

    expect(result.map((resource) => resource.id)).toEqual(['1', '4', '2'])
  })

  it('matches typos with fuzzy edit distance', () => {
    const result = searchResources(fixtures, { query: '图书管' })
    expect(result[0]?.id).toBe('2')
  })

  it('does not treat two-character typos as matches', () => {
    expect(searchResources(fixtures, { query: '网课' }).map((resource) => resource.id)).toEqual([])
  })

  it('matches natural-language and synonym queries to the service entry', () => {
    const bySeat = searchResources(fixtures, { query: '座位预约' })
    expect(bySeat[0]?.id).toBe('1')

    const byQuestion = searchResources(fixtures, { query: '怎么预约图书馆座位' })
    expect(byQuestion[0]?.id).toBe('1')
  })

  it('prefers higher data weights when the text match is similar', () => {
    const tied: Resource[] = [
      { ...fixtures[4], id: 'low', title: '校医院分诊入口', relevanceScore: 1 },
      { ...fixtures[4], id: 'high', title: '校医院分诊入口', relevanceScore: 9 },
    ]
    expect(searchResources(tied, { query: '校医院分诊入口' }).map((resource) => resource.id)).toEqual(['high', 'low'])
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

  it('returns higher-weight resources first for blank queries', () => {
    const result = searchResources(fixtures, {})
    expect(result.map((resource) => resource.id)).toEqual(['1', '2', '5', '3', '4', '6'])
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
