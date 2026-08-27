import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { Resource } from '@/domain/resource'
import ResourceCard from './ResourceCard'

const baseResource: Resource = {
  id: 'demo-resource',
  title: '示例校园资源',
  url: 'https://example.ustc.edu.cn/service',
  category: 'services',
  legacyCategory: '公共服务',
  summary: '用于验证资源入口。',
  tags: ['服务'],
  source: { label: '校级平台', authority: '中国科学技术大学' },
  relevanceScore: 1,
  searchText: '示例校园资源',
}

function renderCard(resource: Resource) {
  return render(<MemoryRouter><ResourceCard resource={resource} /></MemoryRouter>)
}

describe('ResourceCard', () => {
  it('opens the official page from the whole card when a URL exists', () => {
    renderCard(baseResource)

    const link = screen.getByRole('link', { name: '打开官方页面 · 示例校园资源' })
    expect(link).toHaveAttribute('href', 'https://example.ustc.edu.cn/service')
    expect(link).toHaveAttribute('target', '_blank')
    expect(screen.queryByText('查看详情')).not.toBeInTheDocument()
  })

  it('falls back to the internal detail page when the URL is missing', () => {
    renderCard({ ...baseResource, url: undefined })

    const link = screen.getByRole('link', { name: '查看站内详情 · 示例校园资源' })
    expect(link).toHaveAttribute('href', '/resources/demo-resource')
    expect(link).not.toHaveAttribute('target')
  })
})
