import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { DEVICE_HISTORY_OWNER_ID, indexedDbAccountStore } from './profileStore'
import type { AccountStore, ConversationDraft, LocalAccount, LocalSearchRecord, StoredConversation } from './types'

const SESSION_KEY = 'ustc-navigator-active-account'
const LEGACY_SESSION_KEY = 'ustc-navigator-active-profile'

function readActiveAccountId() {
  try {
    return sessionStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

function rememberActiveAccount(accountId: string) {
  try {
    sessionStorage.setItem(SESSION_KEY, accountId)
  } catch {
    // The account remains active in memory until this page session ends.
  }
}

function forgetActiveAccount() {
  try {
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(LEGACY_SESSION_KEY)
  } catch {
    // A blocked session store is equivalent to an already-cleared session.
  }
}

interface AccountContextValue {
  accounts: LocalAccount[]
  activeAccount: LocalAccount | null
  conversations: StoredConversation[]
  searches: LocalSearchRecord[]
  loading: boolean
  storageAvailable: boolean
  migrationNotice: boolean
  register: (username: string, password: string, avatarDataUrl?: string) => Promise<LocalAccount>
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  deleteAccount: (accountId: string) => Promise<void>
  saveConversation: (draft: ConversationDraft) => Promise<StoredConversation | undefined>
  deleteConversation: (conversationId: string) => Promise<void>
  refreshConversations: () => Promise<void>
  saveSearch: (query: string) => Promise<LocalSearchRecord | undefined>
  deleteSearch: (searchId: string) => Promise<void>
  pendingGuestConversation: ConversationDraft | null
  offerGuestConversation: (conversation: ConversationDraft) => void
  clearGuestConversation: () => void
}

const AccountContext = createContext<AccountContextValue | null>(null)

export function AccountProvider({ children, store = indexedDbAccountStore }: PropsWithChildren<{ store?: AccountStore }>) {
  const [accounts, setAccounts] = useState<LocalAccount[]>([])
  const [activeAccount, setActiveAccount] = useState<LocalAccount | null>(null)
  const [conversations, setConversations] = useState<StoredConversation[]>([])
  const [searches, setSearches] = useState<LocalSearchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [migrationNotice, setMigrationNotice] = useState(false)
  const [pendingGuestConversation, setPendingGuestConversation] = useState<ConversationDraft | null>(null)

  const markStorageUnavailable = () => {
    forgetActiveAccount()
    setStorageAvailable(false)
    setActiveAccount(null)
    setConversations([])
    setSearches([])
  }

  useEffect(() => {
    let cancelled = false
    async function initialise() {
      try {
        const available = await store.listAccounts()
        const upgraded = await store.consumeMigrationNotice()
        if (cancelled) return
        setAccounts(available)
        setMigrationNotice(upgraded)
        if (upgraded) forgetActiveAccount()
        const activeId = upgraded ? null : readActiveAccountId()
        const restored = available.find((account) => account.id === activeId) ?? null
        setActiveAccount(restored)
        if (restored) setConversations(await store.listConversations(restored.id))
        setSearches(await store.listSearches(restored?.id ?? DEVICE_HISTORY_OWNER_ID))
      } catch {
        if (!cancelled) markStorageUnavailable()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void initialise()
    return () => { cancelled = true }
  }, [store])

  const refreshAccounts = async () => {
    const available = await store.listAccounts()
    setAccounts(available)
    return available
  }

  const refreshConversations = async () => {
    if (!activeAccount) return setConversations([])
    try {
      setConversations(await store.listConversations(activeAccount.id))
    } catch {
      markStorageUnavailable()
    }
  }

  const register = async (username: string, password: string, avatarDataUrl?: string) => {
    try {
      const account = await store.createAccount(username, password, avatarDataUrl)
      await refreshAccounts()
      rememberActiveAccount(account.id)
      setActiveAccount(account)
      setConversations([])
      setSearches([])
      return account
    } catch (error) {
      if (!(error instanceof Error) || !/用户名|密码/.test(error.message)) markStorageUnavailable()
      throw error
    }
  }

  const login = async (username: string, password: string) => {
    try {
      const verified = await store.verifyCredentials(username, password)
      if (!verified) return false
      await refreshAccounts()
      rememberActiveAccount(verified.id)
      setActiveAccount(verified)
      setConversations(await store.listConversations(verified.id))
      setSearches(await store.listSearches(verified.id))
      return true
    } catch {
      markStorageUnavailable()
      return false
    }
  }

  const logout = () => {
    forgetActiveAccount()
    setActiveAccount(null)
    setConversations([])
    void store.listSearches(DEVICE_HISTORY_OWNER_ID).then(setSearches).catch(markStorageUnavailable)
  }

  const deleteAccount = async (accountId: string) => {
    try {
      await store.deleteAccount(accountId)
      if (activeAccount?.id === accountId) logout()
      await refreshAccounts()
    } catch {
      markStorageUnavailable()
    }
  }

  const saveConversation = async (draft: ConversationDraft) => {
    if (!activeAccount || !storageAvailable) return undefined
    try {
      const saved = await store.saveConversation(activeAccount.id, draft)
      setConversations(await store.listConversations(activeAccount.id))
      return saved
    } catch {
      markStorageUnavailable()
      return undefined
    }
  }

  const deleteConversation = async (conversationId: string) => {
    if (!activeAccount) return
    try {
      await store.deleteConversation(conversationId)
      setConversations(await store.listConversations(activeAccount.id))
    } catch {
      markStorageUnavailable()
    }
  }

  const saveSearch = async (query: string) => {
    if (!storageAvailable) return undefined
    const ownerId = activeAccount?.id ?? DEVICE_HISTORY_OWNER_ID
    try {
      const saved = await store.saveSearch(ownerId, query)
      setSearches(await store.listSearches(ownerId))
      return saved
    } catch {
      markStorageUnavailable()
      return undefined
    }
  }

  const deleteSearch = async (searchId: string) => {
    if (!storageAvailable) return
    const ownerId = activeAccount?.id ?? DEVICE_HISTORY_OWNER_ID
    try {
      await store.deleteSearch(searchId)
      setSearches(await store.listSearches(ownerId))
    } catch {
      markStorageUnavailable()
    }
  }

  return (
    <AccountContext.Provider value={{ accounts, activeAccount, conversations, searches, loading, storageAvailable, migrationNotice, register, login, logout, deleteAccount, saveConversation, deleteConversation, refreshConversations, saveSearch, deleteSearch, pendingGuestConversation, offerGuestConversation: setPendingGuestConversation, clearGuestConversation: () => setPendingGuestConversation(null) }}>
      {children}
    </AccountContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAccount() {
  const context = useContext(AccountContext)
  if (!context) throw new Error('useAccount must be used within AccountProvider')
  return context
}
