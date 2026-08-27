import type { LocalProfile, LocalSearchRecord, ProfileStore, StoredConversation } from './types'

const DATABASE_VERSION = 2
const PROFILE_STORE = 'profiles'
const CONVERSATION_STORE = 'conversations'
const SEARCH_STORE = 'searches'
const PIN_ITERATIONS = 100_000

export const DEVICE_HISTORY_OWNER_ID = '__local_device__'

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function derivePin(pin: string, salt: Uint8Array): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const derived = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PIN_ITERATIONS }, keyMaterial, 256)
  return bytesToBase64(new Uint8Array(derived))
}

export function createIndexedDbProfileStore(options: { databaseName?: string } = {}): ProfileStore {
  const databaseName = options.databaseName ?? 'ustc-navigator'
  let databasePromise: Promise<IDBDatabase> | undefined

  function database(): Promise<IDBDatabase> {
    if (!databasePromise) {
      databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName, DATABASE_VERSION)
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(PROFILE_STORE)) db.createObjectStore(PROFILE_STORE, { keyPath: 'id' })
          if (!db.objectStoreNames.contains(CONVERSATION_STORE)) {
            const store = db.createObjectStore(CONVERSATION_STORE, { keyPath: 'id' })
            store.createIndex('profileId', 'profileId', { unique: false })
            store.createIndex('profileUpdatedAt', ['profileId', 'updatedAt'], { unique: false })
          }
          if (!db.objectStoreNames.contains(SEARCH_STORE)) {
            const store = db.createObjectStore(SEARCH_STORE, { keyPath: 'id' })
            store.createIndex('profileId', 'profileId', { unique: false })
            store.createIndex('profileCreatedAt', ['profileId', 'createdAt'], { unique: false })
          }
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('无法打开本机档案数据库'))
      })
    }
    return databasePromise
  }

  return {
    async listProfiles() {
      const db = await database()
      const transaction = db.transaction(PROFILE_STORE, 'readonly')
      const profiles = await requestResult(transaction.objectStore(PROFILE_STORE).getAll() as IDBRequest<LocalProfile[]>)
      await transactionDone(transaction)
      return profiles.sort((left, right) => right.lastUsedAt.localeCompare(left.lastUsedAt))
    },

    async createProfile(nickname, pin) {
      const normalizedNickname = nickname.trim()
      if (!normalizedNickname) throw new Error('请输入昵称')
      if (!/^\d{4,6}$/.test(pin)) throw new Error('PIN 需要填写 4–6 位数字')
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const now = new Date().toISOString()
      const profile: LocalProfile = {
        id: crypto.randomUUID(),
        nickname: normalizedNickname,
        pinHash: await derivePin(pin, salt),
        pinSalt: bytesToBase64(salt),
        createdAt: now,
        lastUsedAt: now,
      }
      const db = await database()
      const transaction = db.transaction(PROFILE_STORE, 'readwrite')
      transaction.objectStore(PROFILE_STORE).add(profile)
      await transactionDone(transaction)
      return profile
    },

    async verifyPin(profileId, pin) {
      const db = await database()
      const transaction = db.transaction(PROFILE_STORE, 'readonly')
      const profile = await requestResult(transaction.objectStore(PROFILE_STORE).get(profileId) as IDBRequest<LocalProfile | undefined>)
      await transactionDone(transaction)
      if (!profile) return false
      const candidate = await derivePin(pin, base64ToBytes(profile.pinSalt))
      if (candidate !== profile.pinHash) return false
      const update = db.transaction(PROFILE_STORE, 'readwrite')
      update.objectStore(PROFILE_STORE).put({ ...profile, lastUsedAt: new Date().toISOString() })
      await transactionDone(update)
      return true
    },

    async deleteProfile(profileId) {
      const db = await database()
      const transaction = db.transaction([PROFILE_STORE, CONVERSATION_STORE, SEARCH_STORE], 'readwrite')
      transaction.objectStore(PROFILE_STORE).delete(profileId)
      const conversationStore = transaction.objectStore(CONVERSATION_STORE)
      const conversations = await requestResult(conversationStore.index('profileId').getAll(profileId) as IDBRequest<StoredConversation[]>)
      for (const conversation of conversations) conversationStore.delete(conversation.id)
      const searchStore = transaction.objectStore(SEARCH_STORE)
      const searches = await requestResult(searchStore.index('profileId').getAll(profileId) as IDBRequest<LocalSearchRecord[]>)
      for (const search of searches) searchStore.delete(search.id)
      await transactionDone(transaction)
    },

    async listConversations(profileId) {
      const db = await database()
      const transaction = db.transaction(CONVERSATION_STORE, 'readonly')
      const store = transaction.objectStore(CONVERSATION_STORE)
      const request = store.indexNames.contains('profileUpdatedAt')
        ? store.index('profileUpdatedAt').getAll(IDBKeyRange.bound([profileId, ''], [profileId, '\uffff']))
        : store.index('profileId').getAll(profileId)
      const conversations = await requestResult(request as IDBRequest<StoredConversation[]>)
      await transactionDone(transaction)
      return conversations.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    },

    async saveConversation(profileId, conversation) {
      const stored: StoredConversation = { ...conversation, profileId }
      const db = await database()
      const transaction = db.transaction(CONVERSATION_STORE, 'readwrite')
      transaction.objectStore(CONVERSATION_STORE).put(stored)
      await transactionDone(transaction)
      return stored
    },

    async deleteConversation(conversationId) {
      const db = await database()
      const transaction = db.transaction(CONVERSATION_STORE, 'readwrite')
      transaction.objectStore(CONVERSATION_STORE).delete(conversationId)
      await transactionDone(transaction)
    },

    async listSearches(profileId) {
      const db = await database()
      const transaction = db.transaction(SEARCH_STORE, 'readonly')
      const store = transaction.objectStore(SEARCH_STORE)
      const request = store.index('profileCreatedAt').getAll(IDBKeyRange.bound([profileId, ''], [profileId, '\uffff']))
      const searches = await requestResult(request as IDBRequest<LocalSearchRecord[]>)
      await transactionDone(transaction)
      return searches.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    },

    async saveSearch(profileId, query) {
      const normalizedQuery = query.trim()
      if (!normalizedQuery) throw new Error('搜索内容不能为空')
      const search: LocalSearchRecord = {
        id: crypto.randomUUID(),
        profileId,
        query: normalizedQuery,
        createdAt: new Date().toISOString(),
      }
      const db = await database()
      const transaction = db.transaction(SEARCH_STORE, 'readwrite')
      transaction.objectStore(SEARCH_STORE).put(search)
      await transactionDone(transaction)
      return search
    },

    async deleteSearch(searchId) {
      const db = await database()
      const transaction = db.transaction(SEARCH_STORE, 'readwrite')
      transaction.objectStore(SEARCH_STORE).delete(searchId)
      await transactionDone(transaction)
    },
  }
}

export const indexedDbProfileStore = createIndexedDbProfileStore()
