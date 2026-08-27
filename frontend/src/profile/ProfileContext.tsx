import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { indexedDbProfileStore } from './profileStore'
import type { ConversationDraft, LocalProfile, ProfileStore, StoredConversation } from './types'

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
    // Some privacy modes block session storage. The profile remains active
    // until the current React session ends.
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
  loading: boolean
  storageAvailable: boolean
  createProfile: (nickname: string, pin: string) => Promise<LocalProfile>
  unlockProfile: (profileId: string, pin: string) => Promise<boolean>
  lockProfile: () => void
  deleteProfile: (profileId: string) => Promise<void>
  saveConversation: (draft: ConversationDraft) => Promise<StoredConversation | undefined>
  deleteConversation: (conversationId: string) => Promise<void>
  refreshConversations: () => Promise<void>
  pendingGuestConversation: ConversationDraft | null
  offerGuestConversation: (conversation: ConversationDraft) => void
  clearGuestConversation: () => void
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ children, store = indexedDbProfileStore }: PropsWithChildren<{ store?: ProfileStore }>) {
  const [profiles, setProfiles] = useState<LocalProfile[]>([])
  const [activeProfile, setActiveProfile] = useState<LocalProfile | null>(null)
  const [conversations, setConversations] = useState<StoredConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [pendingGuestConversation, setPendingGuestConversation] = useState<ConversationDraft | null>(null)

  const markStorageUnavailable = () => {
    forgetActiveProfile()
    setStorageAvailable(false)
    setActiveProfile(null)
    setConversations([])
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
        if (restored) setConversations(await store.listConversations(restored.id))
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
    if (!activeProfile) return setConversations([])
    try {
      setConversations(await store.listConversations(activeProfile.id))
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
      setConversations([])
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
      setConversations(await store.listConversations(profile.id))
      return true
    } catch {
      markStorageUnavailable()
      return false
    }
  }

  const lockProfile = () => {
    forgetActiveProfile()
    setActiveProfile(null)
    setConversations([])
  }

  const deleteProfile = async (profileId: string) => {
    try {
      await store.deleteProfile(profileId)
      if (activeProfile?.id === profileId) lockProfile()
      await refreshProfiles()
    } catch {
      markStorageUnavailable()
    }
  }

  const saveConversation = async (draft: ConversationDraft) => {
    if (!activeProfile || !storageAvailable) return undefined
    try {
      const saved = await store.saveConversation(activeProfile.id, draft)
      setConversations(await store.listConversations(activeProfile.id))
      return saved
    } catch {
      markStorageUnavailable()
      return undefined
    }
  }

  const deleteConversation = async (conversationId: string) => {
    if (!activeProfile) return
    try {
      await store.deleteConversation(conversationId)
      setConversations(await store.listConversations(activeProfile.id))
    } catch {
      markStorageUnavailable()
    }
  }

  return (
    <ProfileContext.Provider value={{ profiles, activeProfile, conversations, loading, storageAvailable, createProfile, unlockProfile, lockProfile, deleteProfile, saveConversation, deleteConversation, refreshConversations, pendingGuestConversation, offerGuestConversation: setPendingGuestConversation, clearGuestConversation: () => setPendingGuestConversation(null) }}>
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
