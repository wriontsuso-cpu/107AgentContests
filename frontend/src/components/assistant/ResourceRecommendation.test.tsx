import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ResourceRecommendation from './ResourceRecommendation'

describe('ResourceRecommendation', () => {
  it('uses an email action without opening a new tab', () => {
    render(<ResourceRecommendation resource={{
      id: 'email-resource', title: '咨询邮箱', summary: '发送邮件咨询。', category: '校园服务',
      source: '中国科学技术大学', url: 'mailto:help@ustc.edu.cn', accessStatus: 'email',
    }} />)

    const link = screen.getByRole('link', { name: /发送邮件 · 咨询邮箱/ })
    expect(link).toHaveAttribute('href', 'mailto:help@ustc.edu.cn')
    expect(link).not.toHaveAttribute('target')
    expect(screen.getByText('发送邮件')).toBeInTheDocument()
  })

  it('labels a recommendation that requires login', () => {
    render(<ResourceRecommendation resource={{
      id: 'login-resource',
      title: '统一身份认证资源',
      summary: '需要认证的资源。',
      category: '校园服务',
      source: '中国科学技术大学',
      url: 'https://id.ustc.edu.cn/',
      accessStatus: 'login_required',
    }} />)

    expect(screen.getByText('可能需要登录或校内网络')).toBeInTheDocument()
  })
})
