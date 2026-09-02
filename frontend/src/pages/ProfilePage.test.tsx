import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountProvider } from '@/profile/AccountContext'
import { createIndexedDbAccountStore } from '@/profile/profileStore'
import ProfilePage from './ProfilePage'

function renderPage() {
  const store = createIndexedDbAccountStore({ databaseName: `profile-page-${crypto.randomUUID()}` })
  return { store, ...render(<MemoryRouter><AccountProvider store={store}><ProfilePage /></AccountProvider></MemoryRouter>) }
}

async function register(user: ReturnType<typeof userEvent.setup>, username: string, password = 'password-123') {
  await user.type(screen.getByLabelText('用户名'), username)
  await user.type(screen.getByLabelText('设置密码'), password)
  await user.type(screen.getByLabelText('确认密码'), password)
  await user.click(screen.getByRole('button', { name: '注册并登录' }))
}

function createLegacyDatabase(databaseName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('profiles', { keyPath: 'id' }).add({ id: 'legacy', nickname: '旧档案' })
      request.result.createObjectStore('conversations', { keyPath: 'id' })
    }
    request.onsuccess = () => { request.result.close(); resolve() }
    request.onerror = () => reject(request.error)
  })
}

describe('ProfilePage', () => {
  it('uses the photographic profile canvas without the assistant cat artwork', async () => {
    const { container } = renderPage()

    expect(await screen.findByAltText('雪原中的木屋实景')).toHaveAttribute('src', '/brand/profile-snow-barn.webp')
    expect(container.querySelector('img[src="/brand/decorative-cat.svg"]')).toBeNull()
  })

  beforeEach(() => sessionStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('falls back to guest mode when both account storage and session storage are blocked', async () => {
    const store = createIndexedDbAccountStore({ databaseName: `profile-page-${crypto.randomUUID()}` })
    vi.spyOn(store, 'listAccounts').mockRejectedValue(new Error('blocked'))
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked') })

    render(<MemoryRouter><AccountProvider store={store}><ProfilePage /></AccountProvider></MemoryRouter>)

    expect(await screen.findByRole('alert')).toHaveTextContent('已回退为访客模式')
  })

  it('registers a local account with password and an optional avatar field', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole('heading', { name: '注册本机账号' })).toBeInTheDocument()
    expect(screen.getByText('账号与对话仅保存到当前浏览器。')).toBeInTheDocument()
    expect(screen.getByLabelText('上传头像（可选）')).toHaveAttribute('type', 'file')
    await register(user, '余伊健')

    expect(await screen.findByRole('heading', { name: '你好，余伊健' })).toBeInTheDocument()
    expect(screen.getByText('最近保存 0 / 5 次会话')).toBeInTheDocument()
  })

  it('logs out and uses a generic error before accepting valid credentials', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: '注册本机账号' })
    await register(user, '朱荣骐')
    await screen.findByRole('heading', { name: '你好，朱荣骐' })

    await user.click(screen.getByRole('button', { name: '退出登录' }))
    expect(await screen.findByRole('heading', { name: '登录本机账号' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('用户名'), '朱荣骐')
    await user.type(screen.getByLabelText('密码'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: '登录' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('用户名或密码不正确')

    await user.clear(screen.getByLabelText('密码'))
    await user.type(screen.getByLabelText('密码'), 'password-123')
    await user.click(screen.getByRole('button', { name: '登录' }))
    expect(await screen.findByRole('heading', { name: '你好，朱荣骐' })).toBeInTheDocument()
  })

  it('deletes a forgotten-password account only after confirmation', async () => {
    const user = userEvent.setup()
    const { store } = renderPage()
    await screen.findByRole('heading', { name: '注册本机账号' })
    await register(user, '赵世斌')
    await user.click(await screen.findByRole('button', { name: '退出登录' }))

    await user.type(screen.getByLabelText('用户名'), '赵世斌')
    await user.click(screen.getByRole('button', { name: '忘记密码' }))
    expect(screen.getByText(/只能删除这个本机账号后重新注册/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '删除账号并重新注册' }))

    expect(await screen.findByRole('heading', { name: '注册本机账号' })).toBeInTheDocument()
    expect(await store.listAccounts()).toEqual([])
  })

  it('shows a one-time notice after clearing legacy PIN profiles', async () => {
    const databaseName = `profile-page-legacy-${crypto.randomUUID()}`
    await createLegacyDatabase(databaseName)
    const store = createIndexedDbAccountStore({ databaseName })

    render(<MemoryRouter><AccountProvider store={store}><ProfilePage /></AccountProvider></MemoryRouter>)

    expect(await screen.findByRole('status')).toHaveTextContent('本机账号功能已升级，请重新注册')
    expect(await screen.findByRole('heading', { name: '注册本机账号' })).toBeInTheDocument()
  })
})
