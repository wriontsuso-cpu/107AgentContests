import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { AssistantClient } from '@/services/assistantClient'
import AssistantPage from './AssistantPage'
import { ProfileProvider } from '@/profile/ProfileContext'
import { createIndexedDbProfileStore, DEVICE_HISTORY_OWNER_ID } from '@/profile/profileStore'
import type { ProfileStore } from '@/profile/types'

function renderPage(client?: AssistantClient, store: ProfileStore = createIndexedDbProfileStore({ databaseName: `assistant-${crypto.randomUUID()}` })) {
  return render(<MemoryRouter><ProfileProvider store={store}><AssistantPage client={client} /></ProfileProvider></MemoryRouter>)
}

describe('AssistantPage', () => {
  it('starts with guided prompts and rejects empty input', async () => {
    renderPage()

    expect(screen.getByRole('heading', { name: '先说说，你想做什么。' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '夜间书桌、地图与书本插画' })).toHaveAttribute('src', '/brand/assistant-desk.webp')
    expect(screen.getByTestId('canvas-page')).toContainElement(screen.getByRole('textbox', { name: '描述你的需求' }))
    expect(screen.queryByText(/猜部门和系统/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '我想参加竞赛或实践项目' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '发送消息' })).toBeDisabled()
    expect(screen.getByText('演示数据模式')).toBeInTheDocument()
    expect(await screen.findByText('本机保存 · 0 次会话')).toBeInTheDocument()
  })

  it('keeps guest questions and AI replies in searchable local history', async () => {
    const user = userEvent.setup()
    const store = createIndexedDbProfileStore({ databaseName: `assistant-guest-${crypto.randomUUID()}` })
    const client = vi.fn().mockResolvedValue({
      status: 'results', reply: '请从图书馆座位预约入口办理。', clarifications: [], clues: [], resources: [],
    }) as AssistantClient
    renderPage(client, store)

    await screen.findByText('本机保存 · 0 次会话')
    await user.type(screen.getByRole('textbox', { name: '描述你的需求' }), '怎么预约图书馆座位')
    await user.click(screen.getByRole('button', { name: '发送消息' }))

    expect(await screen.findByText('请从图书馆座位预约入口办理。')).toBeInTheDocument()
    expect(await screen.findByText('本机保存 · 1 次会话')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: '搜索历史记录' }), '预约')
    expect(screen.getByRole('button', { name: /^怎么预约图书馆座位/ })).toBeInTheDocument()
    expect((await store.listConversations(DEVICE_HISTORY_OWNER_ID))[0]?.messages).toHaveLength(3)
  })

  it('saves an unlocked profile conversation and exposes it in recent history', async () => {
    const user = userEvent.setup()
    const store = createIndexedDbProfileStore({ databaseName: `assistant-saved-${crypto.randomUUID()}` })
    const profile = await store.createProfile('陈泰然', '3456')
    sessionStorage.setItem('ustc-navigator-active-profile', profile.id)
    const client = vi.fn().mockResolvedValue({
      status: 'results', reply: '这里是校医院入口。', clarifications: [], clues: ['校医院'], resources: [],
    }) as AssistantClient
    renderPage(client, store)

    await screen.findByText('陈泰然 · 本机保存 0 次会话')
    await user.type(screen.getByRole('textbox', { name: '描述你的需求' }), '查询校医院')
    await user.click(screen.getByRole('button', { name: '发送消息' }))

    expect(await screen.findByRole('button', { name: /^查询校医院/ })).toBeInTheDocument()
    expect((await store.listConversations(profile.id))[0]?.messages).toHaveLength(3)
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
      status: 'results',
      reply: '你更偏向竞赛还是科研体验？',
      clarifications: ['参加竞赛', '加入科研项目'],
      clues: ['课外项目'],
      resources: [{
        id: 'demo',
        title: '大学生研究计划',
        summary: '本科生科研实践',
        category: '科研与创新',
        source: '创新创业学院',
        url: 'https://example.ustc.edu.cn/research',
      }],
    })

    expect(await screen.findByText('你更偏向竞赛还是科研体验？')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '参加竞赛' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /大学生研究计划/ })).toHaveAttribute('href', 'https://example.ustc.edu.cn/research')
    expect(screen.getByRole('link', { name: /大学生研究计划/ })).toHaveAttribute('target', '_blank')
    expect(screen.getByText('创新创业学院')).toBeInTheDocument()
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
    expect(screen.getAllByText('查询校医院').length).toBeGreaterThan(0)
  })
})
import 'fake-indexeddb/auto'
