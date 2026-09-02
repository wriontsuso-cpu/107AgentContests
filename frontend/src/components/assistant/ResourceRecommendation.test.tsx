import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ResourceRecommendation from './ResourceRecommendation'

const assistantStyles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')

describe('ResourceRecommendation', () => {
  it('keeps recommendation titles readable on the light card surface', () => {
    render(<ResourceRecommendation resource={{
      id: 'readable-resource',
      title: '奖助学金申请入口',
      summary: '查看申请条件与办理说明。',
      category: '身心健康与权益',
      source: '中国科学技术大学',
      url: 'https://www.ustc.edu.cn/',
    }} />)

    expect(screen.getByText('奖助学金申请入口')).toBeInTheDocument()
    expect(screen.getByText('中国科学技术大学')).toBeInTheDocument()
    expect(assistantStyles).toMatch(/\.assistant-resource\s*>\s*strong\s*\{[^}]*color:\s*#17324c;/s)
    expect(assistantStyles).toMatch(/\.assistant-resource\s*>\s*small\s*\{[^}]*color:\s*#5b6b7f;/s)
  })

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
