import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { RESOURCE_CATEGORIES } from '@/domain/categories'
import { resources } from '@/data/resources'
import HomePage from './HomePage'

function LocationProbe() {
  const location = useLocation()
  return <output aria-label="当前位置">{location.pathname}{location.search}</output>
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/resources" element={<LocationProbe />} />
        <Route path="/assistant" element={<div>AI 导航页面</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('HomePage', () => {
  it('explains the product and presents the complete category atlas', () => {
    renderHome()

    expect(screen.getByRole('heading', { name: /从一个需要，\s*抵达一处资源。/ })).toBeInTheDocument()
    expect(screen.getByText(`已整理 ${resources.length.toLocaleString('zh-CN')} 条校园资源`)).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: '搜索校园资源' })).toBeInTheDocument()

    for (const category of RESOURCE_CATEGORIES) {
      expect(screen.getByRole('link', { name: new RegExp(category.label) })).toBeInTheDocument()
    }
  })

  it('sends a global search to the resource hall', async () => {
    const user = userEvent.setup()
    renderHome()

    await user.type(screen.getByRole('searchbox', { name: '搜索校园资源' }), '图书馆预约')
    await user.click(screen.getByRole('button', { name: '搜索' }))

    expect(screen.getByRole('status', { name: '当前位置' })).toHaveTextContent('/resources?q=%E5%9B%BE%E4%B9%A6%E9%A6%86%E9%A2%84%E7%BA%A6')
  })

  it('connects category and AI entries to their destinations', () => {
    renderHome()

    expect(screen.getByRole('link', { name: /办事与公共服务/ })).toHaveAttribute('href', '/resources?category=services')
    expect(screen.getByRole('link', { name: '让 AI 帮我梳理' })).toHaveAttribute('href', '/assistant')
  })

  it('shows featured resources from the normalized dataset', () => {
    renderHome()

    expect(screen.getByRole('heading', { name: '近期常用入口' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /查看资源/ }).length).toBeGreaterThan(0)
  })
})
