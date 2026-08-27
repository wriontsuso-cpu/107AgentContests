import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
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
  it('keeps the homepage focused on the product and team story', () => {
    renderHome()

    expect(screen.getByRole('heading', { name: '今天，想在科大做点什么？' })).toBeInTheDocument()
    const canvas = screen.getByTestId('canvas-page')
    expect(canvas).toContainElement(screen.getByRole('img', { name: '中国科学技术大学雪后石碑校园实景' }))
    expect(canvas.querySelectorAll('img')).toHaveLength(1)
    expect(screen.queryByText(/不必先知道部门名称/)).not.toBeInTheDocument()
    expect(screen.getByText('已整理 1,295 条校园资源')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: '搜索校园资源' })).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: '在科大，找入口不必绕远路。' })).toBeInTheDocument()
    expect(screen.queryByTestId('home-darkroom')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('canvas-page')).toHaveLength(1)
    expect(screen.getByText(/散落在不同单位页面里的校园资源/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '我们是，啊对对队。' })).toBeInTheDocument()
    expect(screen.getByText(/余伊健、朱荣骐、陈泰然、赵世斌/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '科大很大，入口可以很清楚。' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '近期常用入口' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /还不知道该搜什么/ })).not.toBeInTheDocument()
  })

  it('sends a global search to the resource hall', async () => {
    const user = userEvent.setup()
    renderHome()

    await user.type(screen.getByRole('searchbox', { name: '搜索校园资源' }), '图书馆预约')
    await user.click(screen.getByRole('button', { name: '搜索' }))

    expect(screen.getByRole('status', { name: '当前位置' })).toHaveTextContent('/resources?q=%E5%9B%BE%E4%B9%A6%E9%A6%86%E9%A2%84%E7%BA%A6')
  })

  it('connects the AI entry to its destination', () => {
    renderHome()

    expect(screen.getByRole('link', { name: '让 AI 帮我梳理' })).toHaveAttribute('href', '/assistant')
  })
})
