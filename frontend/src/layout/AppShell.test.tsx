import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import AppShell from './AppShell'
import { ProfileProvider } from '@/profile/ProfileContext'
import { createIndexedDbProfileStore } from '@/profile/profileStore'

function renderShell(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ProfileProvider store={createIndexedDbProfileStore({ databaseName: `shell-${crypto.randomUUID()}` })}>
        <AppShell>
          <div>页面内容</div>
        </AppShell>
      </ProfileProvider>
    </MemoryRouter>,
  )
}

describe('AppShell', () => {
  it('provides primary navigation and a skip link', () => {
    renderShell()

    expect(screen.getByRole('link', { name: '跳到主要内容' })).toHaveAttribute('href', '#main-content')
    expect(screen.getByRole('link', { name: '首页' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '资源大厅' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'AI 导航' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '创建档案' })).toHaveAttribute('href', '/profile')
    expect(screen.getByRole('button', { name: '打开导航菜单' })).toBeInTheDocument()
  })

  it('marks the current section for assistive technology', () => {
    renderShell('/resources')

    expect(screen.getByRole('link', { name: '资源大厅' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: '首页' })).not.toHaveAttribute('aria-current')
  })

  it('discloses that this is a student competition project', () => {
    renderShell()

    expect(screen.getByText('学生参赛项目 · 非正式校务系统')).toBeInTheDocument()
  })
})
