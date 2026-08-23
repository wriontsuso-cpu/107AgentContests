import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { resources } from '@/data/resources'
import { getCategory } from '@/domain/categories'
import ResourceDetailPage from './ResourceDetailPage'

function renderDetail(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/resources/${id}`]}>
      <Routes>
        <Route path="/resources/:id" element={<ResourceDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ResourceDetailPage', () => {
  it('shows traceable resource information and the original destination', () => {
    const resource = resources[0]
    renderDetail(resource.id)

    expect(screen.getByRole('heading', { name: resource.title })).toBeInTheDocument()
    expect(screen.getAllByText(getCategory(resource.category).label).length).toBeGreaterThan(0)
    expect(screen.getAllByText(resource.source.label).length).toBeGreaterThan(0)
    expect(screen.getByText(resource.source.authority)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '前往资源原页面' })).toHaveAttribute('href', resource.url)
    expect(screen.getByRole('link', { name: '前往资源原页面' })).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
  })

  it('shows related resources without repeating the current item', () => {
    const resource = resources[0]
    renderDetail(resource.id)

    expect(screen.getByRole('heading', { name: '或许你还需要' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: `相关资源 · ${resource.title}` })).not.toBeInTheDocument()
  })

  it('handles an unknown id without crashing', () => {
    renderDetail('not-a-real-resource')

    expect(screen.getByRole('heading', { name: '这条资源暂时找不到' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '返回资源大厅' })).toHaveAttribute('href', '/resources')
  })
})
