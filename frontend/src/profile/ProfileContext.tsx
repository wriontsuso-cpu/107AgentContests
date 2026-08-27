import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { DEVICE_HISTORY_OWNER_ID, indexedDbProfileStore } from './profileStore'
import type { ConversationDraft, LocalProfile, LocalSearchRecord, ProfileStore, StoredConversation } from './types'

const SESSION_KEY = 'ustc-navigator-active-profile'

function readActiveProfileId() {
  try {
    return sessionStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

function rememberActiveProfile(profileId: string) {
  try {
    sessionStorage.setItem(SESSION_KEY, profileId)
  } catch {
    // The profile remains active until the current React session ends.
  }
}

function forgetActiveProfile() {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // A blocked store is equivalent to an already-cleared session here.
  }
}

interface ProfileContextValue {
  profiles: LocalProfile[]
  activeProfile: LocalProfile | null
  conversations: StoredConversation[]
  searches: LocalSearchRecord[]
  loading: boolean
  storageAvailable: boolean
  createProfile: (nickname: string, pin: string) => Promise<LocalProfile>
  unlockProfile: (profileId: string, pin: string) => Promise<boolean>
  lockProfile: () => void
  deleteProfile: (profileId: string) => Promise<void>
  saveConversation: (draft: ConversationDraft) => Promise<StoredConversation | undefined>
  deleteConversation: (conversationId: string) => Promise<void>
  refreshConversations: () => Promise<void>
  saveSearch: (query: string) => Promise<LocalSearchRecord | undefined>
  deleteSearch: (searchId: string) => Promise<void>
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ children, store = indexedDbProfileStore }: PropsWithChildren<{ store?: ProfileStore }>) {
  const [profiles, setProfiles] = useState<LocalProfile[]>([])
  const [activeProfile, setActiveProfile] = useState<LocalProfile | null>(null)
  const [conversations, setConversations] = useState<StoredConversation[]>([])
  const [searches, setSearches] = useState<LocalSearchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [storageAvailable, setStorageAvailable] = useState(true)

  const historyOwnerId = activeProfile?.id ?? DEVICE_HISTORY_OWNER_ID

  const markStorageUnavailable = () => {
    forgetActiveProfile()
    setStorageAvailable(false)
    setActiveProfile(null)
    setConversations([])
    setSearches([])
  }

  useEffect(() => {
    let cancelled = false
    async function initialise() {
      try {
        const available = await store.listProfiles()
        if (cancelled) return
        setProfiles(available)
        const activeId = readActiveProfileId()
        const restored = available.find((profile) => profile.id === activeId) ?? null
        setActiveProfile(restored)
        const ownerId = restored?.id ?? DEVICE_HISTORY_OWNER_ID
        const [storedConversations, storedSearches] = await Promise.all([
          store.listConversations(ownerId),
          store.listSearches(ownerId),
        ])
        setConversations(storedConversations)
        setSearches(storedSearches)
      } catch {
        if (!cancelled) markStorageUnavailable()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void initialise()
    return () => { cancelled = true }
  }, [store])

  const refreshProfiles = async () => {
    const available = await store.listProfiles()
    setProfiles(available)
    return available
  }

  const refreshConversations = async () => {
    try {
      setConversations(await store.listConversations(historyOwnerId))
    } catch {
      markStorageUnavailable()
    }
  }

  const createProfile = async (nickname: string, pin: string) => {
    try {
      const profile = await store.createProfile(nickname, pin)
      await refreshProfiles()
      rememberActiveProfile(profile.id)
      setActiveProfile(profile)
      const [storedConversations, storedSearches] = await Promise.all([
        store.listConversations(profile.id),
        store.listSearches(profile.id),
      ])
      setConversations(storedConversations)
      setSearches(storedSearches)
      return profile
    } catch (error) {
      if (!(error instanceof Error) || !/昵称|PIN/.test(error.message)) markStorageUnavailable()
      throw error
    }
  }

  const unlockProfile = async (profileId: string, pin: string) => {
    try {
      if (!(await store.verifyPin(profileId, pin))) return false
      const available = await refreshProfiles()
      const profile = available.find((item) => item.id === profileId) ?? null
      if (!profile) return false
      rememberActiveProfile(profile.id)
      setActiveProfile(profile)
      const [storedConversations, storedSearches] = await Promise.all([
        store.listConversations(profile.id),
        store.listSearches(profile.id),
      ])
      setConversations(storedConversations)
      setSearches(storedSearches)
      return true
    } catch {
      markStorageUnavailable()
      return false
    }
  }

  const lockProfile = () => {
    forgetActiveProfile()
    setActiveProfile(null)
    void Promise.all([
      store.listConversations(DEVICE_HISTORY_OWNER_ID),
      store.listSearches(DEVICE_HISTORY_OWNER_ID),
    ])
      .then(([storedConversations, storedSearches]) => {
        setConversations(storedConversations)
        setSearches(storedSearches)
      })
      .catch(markStorageUnavailable)
  }

  const deleteProfile = async (profileId: string) => {
    try {
      await store.deleteProfile(profileId)
      if (activeProfile?.id === profileId) {
        forgetActiveProfile()
        setActiveProfile(null)
        const [storedConversations, storedSearches] = await Promise.all([
          store.listConversations(DEVICE_HISTORY_OWNER_ID),
          store.listSearches(DEVICE_HISTORY_OWNER_ID),
        ])
        setConversations(storedConversations)
        setSearches(storedSearches)
      }
      await refreshProfiles()
    } catch {
      markStorageUnavailable()
    }
  }

  const saveConversation = async (draft: ConversationDraft) => {
    if (!storageAvailable) return undefined
    try {
      const saved = await store.saveConversation(historyOwnerId, draft)
      setConversations(await store.listConversations(historyOwnerId))
      return saved
    } catch {
      markStorageUnavailable()
      return undefined
    }
  }

  const deleteConversation = async (conversationId: string) => {
    if (!storageAvailable) return
    try {
      await store.deleteConversation(conversationId)
      setConversations(await store.listConversations(historyOwnerId))
    } catch {
      markStorageUnavailable()
    }
  }

  const saveSearch = async (query: string) => {
    if (!storageAvailable || !query.trim()) return undefined
    try {
      const saved = await store.saveSearch(historyOwnerId, query)
      setSearches(await store.listSearches(historyOwnerId))
      return saved
    } catch {
      markStorageUnavailable()
      return undefined
    }
  }

  const deleteSearch = async (searchId: string) => {
    if (!storageAvailable) return
    try {
      await store.deleteSearch(searchId)
      setSearches(await store.listSearches(historyOwnerId))
    } catch {
      markStorageUnavailable()
    }
  }

  return (
    <ProfileContext.Provider value={{ profiles, activeProfile, conversations, searches, loading, storageAvailable, createProfile, unlockProfile, lockProfile, deleteProfile, saveConversation, deleteConversation, refreshConversations, saveSearch, deleteSearch }}>
      {children}
    </ProfileContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProfile() {
  const context = useContext(ProfileContext)
  if (!context) throw new Error('useProfile must be used within ProfileProvider')
  return context
}
