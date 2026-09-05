import type { AccountStore, LocalAccount, LocalSearchRecord, StoredConversation } from './types'

const DATABASE_VERSION = 3
const ACCOUNT_STORE = 'accounts'
const CONVERSATION_STORE = 'conversations'
const SEARCH_STORE = 'searches'
const META_STORE = 'meta'
const MIGRATION_NOTICE_KEY = 'v2-migration-notice'
const PASSWORD_ITERATIONS = 210_000

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

export function normalizeUsername(username: string): string {
  return username.trim().normalize('NFKC').toLocaleLowerCase('zh-CN')
}

function validateUsername(username: string): { username: string; normalizedUsername: string } {
  const trimmed = username.trim().normalize('NFKC')
  const length = [...trimmed].length
  if (length < 2 || length > 24) throw new Error('用户名需要填写 2–24 个字符')
  if (!/^[\p{L}\p{N}_-]+$/u.test(trimmed)) throw new Error('用户名只能包含中英文、数字、下划线和短横线')
  return { username: trimmed, normalizedUsername: normalizeUsername(trimmed) }
}

function validatePassword(password: string): void {
  if (password.length < 8 || password.length > 128) throw new Error('密码需要填写 8–128 个字符')
  if (!password.trim()) throw new Error('密码不能全部为空白')
}

async function derivePassword(password: string, salt: Uint8Array): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const derived = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PASSWORD_ITERATIONS }, keyMaterial, 256)
  return bytesToBase64(new Uint8Array(derived))
}

export function createIndexedDbAccountStore(options: { databaseName?: string } = {}): AccountStore {
  const databaseName = options.databaseName ?? 'ustc-navigator'
  let databasePromise: Promise<IDBDatabase> | undefined

  function database(): Promise<IDBDatabase> {
    if (!databasePromise) {
      databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName, DATABASE_VERSION)
        request.onupgradeneeded = (event) => {
          const db = request.result
          const oldVersion = event.oldVersion

          if (db.objectStoreNames.contains('profiles')) db.deleteObjectStore('profiles')
          if (db.objectStoreNames.contains(CONVERSATION_STORE)) db.deleteObjectStore(CONVERSATION_STORE)
          if (db.objectStoreNames.contains(SEARCH_STORE)) db.deleteObjectStore(SEARCH_STORE)

          if (!db.objectStoreNames.contains(ACCOUNT_STORE)) {
            const accounts = db.createObjectStore(ACCOUNT_STORE, { keyPath: 'id' })
            accounts.createIndex('normalizedUsername', 'normalizedUsername', { unique: true })
          }
          const conversations = db.createObjectStore(CONVERSATION_STORE, { keyPath: 'id' })
          conversations.createIndex('accountId', 'accountId', { unique: false })
          conversations.createIndex('accountUpdatedAt', ['accountId', 'updatedAt'], { unique: false })
          const searches = db.createObjectStore(SEARCH_STORE, { keyPath: 'id' })
          searches.createIndex('accountId', 'accountId', { unique: false })
          searches.createIndex('accountCreatedAt', ['accountId', 'createdAt'], { unique: false })
          if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' })

          if (oldVersion > 0 && oldVersion < DATABASE_VERSION) {
            request.transaction?.objectStore(META_STORE).put({ key: MIGRATION_NOTICE_KEY, value: true })
          }
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('无法打开本机账号数据库'))
      })
    }
    return databasePromise
  }

  return {
    async listAccounts() {
      const db = await database()
      const transaction = db.transaction(ACCOUNT_STORE, 'readonly')
      const accounts = await requestResult(transaction.objectStore(ACCOUNT_STORE).getAll() as IDBRequest<LocalAccount[]>)
      await transactionDone(transaction)
      return accounts.sort((left, right) => right.lastUsedAt.localeCompare(left.lastUsedAt))
    },

    async createAccount(usernameInput, password, avatarDataUrl) {
      const { username, normalizedUsername } = validateUsername(usernameInput)
      validatePassword(password)
      const db = await database()
      const duplicateTransaction = db.transaction(ACCOUNT_STORE, 'readonly')
      const duplicate = await requestResult(duplicateTransaction.objectStore(ACCOUNT_STORE).index('normalizedUsername').get(normalizedUsername) as IDBRequest<LocalAccount | undefined>)
      await transactionDone(duplicateTransaction)
      if (duplicate) throw new Error('用户名已存在')

      const salt = crypto.getRandomValues(new Uint8Array(16))
      const now = new Date().toISOString()
      const account: LocalAccount = {
        id: crypto.randomUUID(),
        username,
        normalizedUsername,
        passwordHash: await derivePassword(password, salt),
        passwordSalt: bytesToBase64(salt),
        ...(avatarDataUrl ? { avatarDataUrl } : {}),
        createdAt: now,
        lastUsedAt: now,
      }
      const transaction = db.transaction(ACCOUNT_STORE, 'readwrite')
      transaction.objectStore(ACCOUNT_STORE).add(account)
      await transactionDone(transaction)
      return account
    },

    async verifyCredentials(username, password) {
      const db = await database()
      const transaction = db.transaction(ACCOUNT_STORE, 'readonly')
      const account = await requestResult(transaction.objectStore(ACCOUNT_STORE).index('normalizedUsername').get(normalizeUsername(username)) as IDBRequest<LocalAccount | undefined>)
      await transactionDone(transaction)
      if (!account) return null
      const candidate = await derivePassword(password, base64ToBytes(account.passwordSalt))
      if (candidate !== account.passwordHash) return null
      const updated = { ...account, lastUsedAt: new Date().toISOString() }
      const update = db.transaction(ACCOUNT_STORE, 'readwrite')
      update.objectStore(ACCOUNT_STORE).put(updated)
      await transactionDone(update)
      return updated
    },

    async deleteAccount(accountId) {
      const db = await database()
      const transaction = db.transaction([ACCOUNT_STORE, CONVERSATION_STORE, SEARCH_STORE], 'readwrite')
      transaction.objectStore(ACCOUNT_STORE).delete(accountId)
      const conversationStore = transaction.objectStore(CONVERSATION_STORE)
      const conversations = await requestResult(conversationStore.index('accountId').getAll(accountId) as IDBRequest<StoredConversation[]>)
      for (const conversation of conversations) conversationStore.delete(conversation.id)
      const searchStore = transaction.objectStore(SEARCH_STORE)
      const searches = await requestResult(searchStore.index('accountId').getAll(accountId) as IDBRequest<LocalSearchRecord[]>)
      for (const search of searches) searchStore.delete(search.id)
      await transactionDone(transaction)
    },

    async consumeMigrationNotice() {
      const db = await database()
      const transaction = db.transaction(META_STORE, 'readwrite')
      const store = transaction.objectStore(META_STORE)
      const notice = await requestResult(store.get(MIGRATION_NOTICE_KEY) as IDBRequest<{ key: string; value: boolean } | undefined>)
      if (notice) store.delete(MIGRATION_NOTICE_KEY)
      await transactionDone(transaction)
      return Boolean(notice?.value)
    },

    async listConversations(accountId) {
      const db = await database()
      const transaction = db.transaction(CONVERSATION_STORE, 'readonly')
      const store = transaction.objectStore(CONVERSATION_STORE)
      const conversations = await requestResult(store.index('accountUpdatedAt').getAll(IDBKeyRange.bound([accountId, ''], [accountId, '\uffff'])) as IDBRequest<StoredConversation[]>)
      await transactionDone(transaction)
      return conversations.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    },

    async saveConversation(accountId, conversation) {
      const stored: StoredConversation = { ...conversation, accountId }
      const db = await database()
      const transaction = db.transaction(CONVERSATION_STORE, 'readwrite')
      const store = transaction.objectStore(CONVERSATION_STORE)
      store.put(stored)
      await transactionDone(transaction)
      return stored
    },

    async deleteConversation(conversationId) {
      const db = await database()
      const transaction = db.transaction(CONVERSATION_STORE, 'readwrite')
      transaction.objectStore(CONVERSATION_STORE).delete(conversationId)
      await transactionDone(transaction)
    },

    async listSearches(accountId) {
      const db = await database()
      const transaction = db.transaction(SEARCH_STORE, 'readonly')
      const request = transaction.objectStore(SEARCH_STORE).index('accountCreatedAt').getAll(IDBKeyRange.bound([accountId, ''], [accountId, '\uffff']))
      const searches = await requestResult(request as IDBRequest<LocalSearchRecord[]>)
      await transactionDone(transaction)
      return searches.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    },

    async saveSearch(accountId, query) {
      const normalizedQuery = query.trim()
      if (!normalizedQuery) throw new Error('搜索内容不能为空')
      const search: LocalSearchRecord = { id: crypto.randomUUID(), accountId, query: normalizedQuery, createdAt: new Date().toISOString() }
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

export const indexedDbAccountStore = createIndexedDbAccountStore()
