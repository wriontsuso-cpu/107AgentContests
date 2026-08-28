import type { AssistantResponse } from '@/services/assistantClient'

export interface LocalAccount {
  id: string
  username: string
  normalizedUsername: string
  passwordHash: string
  passwordSalt: string
  avatarDataUrl?: string
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
  accountId: string
  title: string
  messages: StoredConversationMessage[]
  createdAt: string
  updatedAt: string
}

export type ConversationDraft = Omit<StoredConversation, 'accountId'>

export interface AccountStore {
  listAccounts(): Promise<LocalAccount[]>
  createAccount(username: string, password: string, avatarDataUrl?: string): Promise<LocalAccount>
  verifyCredentials(username: string, password: string): Promise<LocalAccount | null>
  deleteAccount(accountId: string): Promise<void>
  consumeMigrationNotice(): Promise<boolean>
  listConversations(accountId: string): Promise<StoredConversation[]>
  saveConversation(accountId: string, conversation: ConversationDraft): Promise<StoredConversation>
  deleteConversation(conversationId: string): Promise<void>
}
