import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createIndexedDbAccountStore } from './profileStore'

function createStore(databaseName = `ustc-navigator-test-${crypto.randomUUID()}`) {
  return createIndexedDbAccountStore({ databaseName })
}

function createLegacyDatabase(databaseName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      database.createObjectStore('profiles', { keyPath: 'id' }).add({ id: 'legacy-profile', nickname: '旧档案' })
      database.createObjectStore('conversations', { keyPath: 'id' }).add({ id: 'legacy-conversation', profileId: 'legacy-profile' })
    }
    request.onsuccess = () => {
      request.result.close()
      resolve()
    }
    request.onerror = () => reject(request.error)
  })
}

describe('IndexedDB account store', () => {
  it('registers a unique normalized username and verifies a salted password derivative', async () => {
    const store = createStore()
    const account = await store.createAccount(' 科大_User ', 'correct horse battery staple')

    expect(account).toMatchObject({ username: '科大_User', normalizedUsername: '科大_user' })
    expect(account.passwordHash).not.toBe('correct horse battery staple')
    expect(account.passwordSalt).not.toBe('')
    await expect(store.verifyCredentials('科大_USER', 'correct horse battery staple')).resolves.toMatchObject({ id: account.id })
    await expect(store.verifyCredentials('科大_User', 'wrong password')).resolves.toBeNull()
    await expect(store.createAccount('科大_user', 'another valid password')).rejects.toThrow('用户名已存在')
  })

  it('rejects invalid usernames and passwords', async () => {
    const store = createStore()

    await expect(store.createAccount('a', '12345678')).rejects.toThrow('用户名需要填写 2–24 个字符')
    await expect(store.createAccount('hello world', '12345678')).rejects.toThrow('用户名只能包含')
    await expect(store.createAccount('valid-user', '1234567')).rejects.toThrow('密码需要填写 8–128 个字符')
    await expect(store.createAccount('valid-user', '        ')).rejects.toThrow('密码不能全部为空白')
  })

  it('isolates accounts and retains only the five most recent conversations', async () => {
    const store = createStore()
    const first = await store.createAccount('account-one', 'password-one')
    const second = await store.createAccount('account-two', 'password-two')

    for (let index = 1; index <= 6; index += 1) {
      await store.saveConversation(first.id, {
        id: `first-${index}`,
        title: `会话 ${index}`,
        messages: [{ role: 'user', content: `问题 ${index}` }],
        createdAt: `2026-08-25T00:00:0${index}.000Z`,
        updatedAt: `2026-08-25T00:00:0${index}.000Z`,
      })
    }
    await store.saveConversation(second.id, {
      id: 'second-1',
      title: '另一账号',
      messages: [{ role: 'user', content: '另一问题' }],
      createdAt: '2026-08-25T00:01:00.000Z',
      updatedAt: '2026-08-25T00:01:00.000Z',
    })

    expect((await store.listConversations(first.id)).map((item) => item.title)).toEqual(['会话 6', '会话 5', '会话 4', '会话 3', '会话 2'])
    expect(await store.listConversations(second.id)).toHaveLength(1)
  })

  it('deletes an account together with its conversations', async () => {
    const store = createStore()
    const account = await store.createAccount('delete-me', 'password-delete')
    await store.saveConversation(account.id, {
      id: 'conversation',
      title: '待删除',
      messages: [{ role: 'user', content: '测试' }],
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    })

    await store.deleteAccount(account.id)

    expect(await store.listAccounts()).toEqual([])
    expect(await store.listConversations(account.id)).toEqual([])
  })

  it('clears v1 PIN profiles and exposes the upgrade notice once', async () => {
    const databaseName = `ustc-navigator-legacy-${crypto.randomUUID()}`
    await createLegacyDatabase(databaseName)
    const store = createStore(databaseName)

    expect(await store.listAccounts()).toEqual([])
    await expect(store.consumeMigrationNotice()).resolves.toBe(true)
    await expect(store.consumeMigrationNotice()).resolves.toBe(false)
  })
})
