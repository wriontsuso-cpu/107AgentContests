import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfileProvider } from '@/profile/ProfileContext'
import { createIndexedDbProfileStore } from '@/profile/profileStore'
import ProfilePage from './ProfilePage'

function renderPage() {
  const store = createIndexedDbProfileStore({ databaseName: `profile-page-${crypto.randomUUID()}` })
  return render(<MemoryRouter><ProfileProvider store={store}><ProfilePage /></ProfileProvider></MemoryRouter>)
}

describe('ProfilePage', () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('falls back to guest mode when both profile storage and session storage are blocked', async () => {
    const store = createIndexedDbProfileStore({ databaseName: `profile-page-${crypto.randomUUID()}` })
    vi.spyOn(store, 'listProfiles').mockRejectedValue(new Error('blocked'))
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked') })

    render(<MemoryRouter><ProfileProvider store={store}><ProfilePage /></ProfileProvider></MemoryRouter>)

    expect(await screen.findByRole('alert')).toHaveTextContent('已回退为访客模式')
  })

  it('creates a local profile and explains the storage boundary', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole('heading', { name: '本机档案，只属于这台浏览器。' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '明亮的林荫校园步道' })).toHaveAttribute('src', '/brand/profile-walkway.webp')
    expect(screen.getByTestId('canvas-page')).toContainElement(screen.getByLabelText('昵称'))
    expect(screen.getByText(/不能跨设备同步/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('昵称'), '余伊健')
    await user.type(screen.getByLabelText('设置 PIN'), '1234')
    await user.type(screen.getByLabelText('确认 PIN'), '1234')
    await user.click(screen.getByRole('button', { name: '创建并进入' }))

    expect(await screen.findByRole('heading', { name: '你好，余伊健。' })).toBeInTheDocument()
    expect(screen.getByText('最近保存 0 / 5 次会话')).toBeInTheDocument()
  })

  it('locks the profile and rejects an incorrect PIN before unlocking', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: '本机档案，只属于这台浏览器。' })
    await user.type(screen.getByLabelText('昵称'), '朱荣骐')
    await user.type(screen.getByLabelText('设置 PIN'), '2345')
    await user.type(screen.getByLabelText('确认 PIN'), '2345')
    await user.click(screen.getByRole('button', { name: '创建并进入' }))
    await screen.findByRole('heading', { name: '你好，朱荣骐。' })

    await user.click(screen.getByRole('button', { name: '锁定档案' }))
    expect(await screen.findByRole('heading', { name: '解锁本机档案' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('输入 PIN'), '9999')
    await user.click(screen.getByRole('button', { name: '解锁' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('PIN 不正确')

    await user.clear(screen.getByLabelText('输入 PIN'))
    await user.type(screen.getByLabelText('输入 PIN'), '2345')
    await user.click(screen.getByRole('button', { name: '解锁' }))
    expect(await screen.findByRole('heading', { name: '你好，朱荣骐。' })).toBeInTheDocument()
  })

  it('requires confirmation before permanently deleting a profile', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: '本机档案，只属于这台浏览器。' })
    await user.type(screen.getByLabelText('昵称'), '赵世斌')
    await user.type(screen.getByLabelText('设置 PIN'), '4567')
    await user.type(screen.getByLabelText('确认 PIN'), '4567')
    await user.click(screen.getByRole('button', { name: '创建并进入' }))

    await user.click(await screen.findByRole('button', { name: '删除档案' }))
    expect(screen.getByText(/档案和其中的会话将永久删除/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认永久删除' }))
    expect(await screen.findByRole('heading', { name: '本机档案，只属于这台浏览器。' })).toBeInTheDocument()
  })
})
