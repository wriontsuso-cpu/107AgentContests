import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ResourcesPage from './ResourcesPage'
import { ProfileProvider } from '@/profile/ProfileContext'
import { createIndexedDbProfileStore } from '@/profile/profileStore'

function LocationProbe() {
  const location = useLocation()
  return <output aria-label="当前位置">{location.search}</output>
}

function renderPage(path = '/resources') {
  const store = createIndexedDbProfileStore({ databaseName: `resources-${crypto.randomUUID()}` })
  return render(
    <ProfileProvider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/resources" element={<ResourcesPage />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </ProfileProvider>,
  )
}

describe('ResourcesPage', () => {
  it('keeps the resource workspace on one visible photographic canvas', () => {
    renderPage()

    expect(screen.getByRole('heading', { name: '要找的入口，从这里出发。' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '夕阳下的大学校园草坪与远景学生' })).toHaveAttribute('src', '/brand/home-campus-life-wide.webp')
    expect(screen.getByTestId('canvas-page')).toContainElement(screen.getByRole('searchbox', { name: '搜索资源' }))
    expect(screen.queryByText(/把分散的入口/)).not.toBeInTheDocument()
  })

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
    expect((await screen.findAllByRole('link', { name: /打开官方页面/ })).length).toBeGreaterThan(0)
  })

  it('keeps resource queries in reusable local search history', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText(/条结果/)

    await user.type(screen.getByRole('searchbox', { name: '搜索资源' }), '图书馆预约')
    await user.click(screen.getByRole('button', { name: /^搜索$/ }))

    expect(await screen.findByRole('region', { name: '最近搜索' })).toHaveTextContent('图书馆预约')
  })

  it('offers a mobile filter drawer control', async () => {
    const user = userEvent.setup()
    renderPage()

    const trigger = screen.getByRole('button', { name: '打开分类筛选' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await user.click(trigger)
    expect(screen.getByRole('button', { name: '关闭分类筛选' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('preserves a group when a tag is selected before the route rerenders', () => {
    renderPage('/resources?q=图书馆&category=learning')

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^图书馆资源$/ }))
      fireEvent.change(screen.getByLabelText('标签', { exact: true }), { target: { value: '图书馆资源' } })
    })

    expect(screen.getByRole('status', { name: '当前位置' })).toHaveTextContent('group=')
    expect(screen.getByRole('status', { name: '当前位置' })).toHaveTextContent('tag=')
  })
})
