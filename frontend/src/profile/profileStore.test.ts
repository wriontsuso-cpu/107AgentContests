import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createIndexedDbProfileStore } from './profileStore'

function createStore() {
  return createIndexedDbProfileStore({ databaseName: `ustc-navigator-test-${crypto.randomUUID()}` })
}

describe('IndexedDB profile store', () => {
  it('stores a salted PIN derivative and verifies the correct PIN', async () => {
    const store = createStore()
    const profile = await store.createProfile('余伊健', '1234')

    expect(profile.nickname).toBe('余伊健')
    expect(profile.pinHash).not.toBe('1234')
    expect(profile.pinSalt).not.toBe('')
    await expect(store.verifyPin(profile.id, '1234')).resolves.toBe(true)
    await expect(store.verifyPin(profile.id, '9999')).resolves.toBe(false)
  })

  it('isolates profiles and retains only the five most recent conversations', async () => {
    const store = createStore()
    const first = await store.createProfile('朱荣骐', '2345')
    const second = await store.createProfile('陈泰然', '3456')

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
      title: '另一档案',
      messages: [{ role: 'user', content: '另一问题' }],
      createdAt: '2026-08-25T00:01:00.000Z',
      updatedAt: '2026-08-25T00:01:00.000Z',
    })

    const firstHistory = await store.listConversations(first.id)
    expect(firstHistory).toHaveLength(5)
    expect(firstHistory.map((item) => item.title)).toEqual(['会话 6', '会话 5', '会话 4', '会话 3', '会话 2'])
    expect(await store.listConversations(second.id)).toHaveLength(1)
  })

  it('deletes a profile together with its conversations', async () => {
    const store = createStore()
    const profile = await store.createProfile('赵世斌', '4567')
    await store.saveConversation(profile.id, {
      id: 'conversation',
      title: '待删除',
      messages: [{ role: 'user', content: '测试' }],
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    })

    await store.deleteProfile(profile.id)

    expect(await store.listProfiles()).toEqual([])
    expect(await store.listConversations(profile.id)).toEqual([])
  })
})
