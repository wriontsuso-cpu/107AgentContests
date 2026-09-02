import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Resource } from '@/domain/resource'
import ResourceMetadata from './ResourceMetadata'

const resource: Resource = {
  id: 'login-resource',
  title: '统一身份认证资源',
  url: 'https://id.ustc.edu.cn/',
  category: 'services',
  legacyCategory: '公共服务',
  summary: '需要认证的资源。',
  tags: [],
  source: { label: '校级平台', authority: '中国科学技术大学' },
  relevanceScore: 1,
  searchText: '统一身份认证资源',
  accessStatus: 'login_required',
  accessNote: '登录墙：需统一身份认证',
}

describe('ResourceMetadata', () => {
  it('explains that an audited blocked resource is still valid behind login', () => {
    render(<ResourceMetadata resource={resource} />)

    expect(screen.getByText('访问提示')).toBeInTheDocument()
    expect(screen.getByText('可能需要登录或校内网络')).toBeInTheDocument()
    expect(screen.getByText('登录墙：需统一身份认证')).toBeInTheDocument()
  })
})
