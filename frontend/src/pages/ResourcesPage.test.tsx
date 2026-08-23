import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ResourcesPage from './ResourcesPage'

function renderPage(path = '/resources') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/resources" element={<ResourcesPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ResourcesPage', () => {
  it('restores search and category state from the URL', async () => {
    renderPage('/resources?q=%E5%9B%BE%E4%B9%A6%E9%A6%86&category=learning')

    expect(screen.getByRole('searchbox', { name: '搜索资源' })).toHaveValue('图书馆')
    expect(screen.getByRole('button', { name: /学习与学术/ })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText(/条结果/)).toBeInTheDocument()
  })

  it('updates results and can clear all filters', async () => {
    const user = userEvent.setup()
    renderPage('/resources?q=%E4%B8%8D%E5%AD%98%E5%9C%A8%E7%9A%84%E8%B5%84%E6%BA%90')

    const emptyState = (await screen.findByText('没有找到匹配的资源')).closest<HTMLElement>('.resource-empty')!
    await user.click(within(emptyState).getByRole('button', { name: '清除筛选' }))
    expect(screen.getByRole('searchbox', { name: '搜索资源' })).toHaveValue('')
    expect((await screen.findAllByRole('link', { name: /查看详情/ })).length).toBeGreaterThan(0)
  })

  it('offers a mobile filter drawer control', async () => {
    const user = userEvent.setup()
    renderPage()

    const trigger = screen.getByRole('button', { name: '打开分类筛选' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await user.click(trigger)
    expect(screen.getByRole('button', { name: '关闭分类筛选' })).toHaveAttribute('aria-expanded', 'true')
  })
})
