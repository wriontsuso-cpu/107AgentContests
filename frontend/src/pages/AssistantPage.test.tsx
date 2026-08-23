import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { AssistantClient } from '@/services/assistantClient'
import AssistantPage from './AssistantPage'

function renderPage(client?: AssistantClient) {
  return render(<MemoryRouter><AssistantPage client={client} /></MemoryRouter>)
}

describe('AssistantPage', () => {
  it('starts with guided prompts and rejects empty input', () => {
    renderPage()

    expect(screen.getByRole('heading', { name: '先说说，你现在想做什么？' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '我想参加竞赛或实践项目' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '发送消息' })).toBeDisabled()
    expect(screen.getByText('演示数据模式')).toBeInTheDocument()
  })

  it('submits a need and renders clarification plus recommendations', async () => {
    const user = userEvent.setup()
    let resolveResponse!: Parameters<ConstructorParameters<typeof Promise>[0]>[0]
    const responsePromise = new Promise((resolve) => { resolveResponse = resolve })
    const client = vi.fn(() => responsePromise) as unknown as AssistantClient
    renderPage(client)

    await user.type(screen.getByRole('textbox', { name: '描述你的需求' }), '我想做点课外项目')
    await user.click(screen.getByRole('button', { name: '发送消息' }))
    expect(screen.getByText('正在梳理你的需求…')).toBeInTheDocument()

    resolveResponse({
      reply: '你更偏向竞赛还是科研体验？',
      clarifications: ['参加竞赛', '加入科研项目'],
      clues: ['课外项目'],
      resources: [{ id: 'demo', title: '大学生研究计划', summary: '本科生科研实践', category: '科研与创新', url: '/resources/demo' }],
    })

    expect(await screen.findByText('你更偏向竞赛还是科研体验？')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '参加竞赛' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /大学生研究计划/ })).toHaveAttribute('href', '/resources/demo')
    expect(screen.getByText('课外项目')).toBeInTheDocument()
  })

  it('shows a retryable error instead of losing the conversation', async () => {
    const user = userEvent.setup()
    const client = vi.fn().mockRejectedValue(new Error('导航服务暂时不可用，请稍后重试。')) as AssistantClient
    renderPage(client)

    await user.type(screen.getByRole('textbox', { name: '描述你的需求' }), '查询校医院')
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('导航服务暂时不可用')
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
    expect(screen.getByText('查询校医院')).toBeInTheDocument()
  })
})
