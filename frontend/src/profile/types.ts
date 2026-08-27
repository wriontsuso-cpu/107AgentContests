import type { AssistantResponse } from '@/services/assistantClient'

export interface LocalProfile {
  id: string
  nickname: string
  pinHash: string
  pinSalt: string
  createdAt: string
  lastUsedAt: string
}

export interface StoredConversationMessage {
  role: 'user' | 'assistant'
  content: string
  response?: AssistantResponse
}

export interface StoredConversation {
  id: string
  profileId: string
  title: string
  messages: StoredConversationMessage[]
  createdAt: string
  updatedAt: string
}

export type ConversationDraft = Omit<StoredConversation, 'profileId'>

export interface LocalSearchRecord {
  id: string
  profileId: string
  query: string
  createdAt: string
}

export interface ProfileStore {
  listProfiles(): Promise<LocalProfile[]>
  createProfile(nickname: string, pin: string): Promise<LocalProfile>
  verifyPin(profileId: string, pin: string): Promise<boolean>
  deleteProfile(profileId: string): Promise<void>
  listConversations(profileId: string): Promise<StoredConversation[]>
  saveConversation(profileId: string, conversation: ConversationDraft): Promise<StoredConversation>
  deleteConversation(conversationId: string): Promise<void>
  listSearches(profileId: string): Promise<LocalSearchRecord[]>
  saveSearch(profileId: string, query: string): Promise<LocalSearchRecord>
  deleteSearch(searchId: string): Promise<void>
}
