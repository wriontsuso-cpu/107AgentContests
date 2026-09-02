import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MarkdownMessage from './MarkdownMessage'

describe('MarkdownMessage', () => {
  it('renders headings, emphasis, paragraphs, lists, quotes, and code', () => {
    render(<MarkdownMessage content={`## 办理建议

请先查看 **教务系统**，再完成以下步骤：

1. 登录账号
2. 选择服务

> 最终信息以官方页面为准。

使用 \`Ctrl+F\` 搜索。

\`\`\`text
line one
line two
\`\`\``} />)

    expect(screen.getByRole('heading', { name: '办理建议', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('教务系统').tagName).toBe('STRONG')
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getByText(/最终信息/).closest('blockquote')).toBeInTheDocument()
    expect(screen.getByText('Ctrl+F').tagName).toBe('CODE')
    expect(screen.getByText(/line one/).closest('pre')).toBeInTheDocument()
  })

  it('supports GFM tables and safe external links', () => {
    render(<MarkdownMessage content={`| 资源 | 状态 |
| --- | --- |
| 教务系统 | 可用 |

[查看官网](https://www.ustc.edu.cn/)`} />)

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '查看官网' })).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: '查看官网' })).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
  })

  it('does not mount model-supplied raw HTML', () => {
    const { container } = render(<MarkdownMessage content={'<script>alert("x")</script><img src=x onerror=alert(1)>'} />)

    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })

  it('blocks dangerous link protocols and remote tracking images', () => {
    const { container } = render(<MarkdownMessage content={'[危险链接](javascript:alert(1)) ![追踪像素](https://evil.example/pixel.gif)'} />)

    expect(screen.queryByRole('link', { name: '危险链接' })).toBeNull()
    expect(screen.getByText('危险链接')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })
})
