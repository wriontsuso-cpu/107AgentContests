import type { ResourceCategoryId } from './categories'

export interface ResourceSource {
  label: string
  authority: string
  site?: string
}

export type ResourceAccessStatus = 'direct' | 'login_required' | 'local' | 'email'

export interface Resource {
  id: string
  title: string
  url?: string
  category: ResourceCategoryId
  legacyCategory: string
  summary: string
  content?: string
  tags: string[]
  source: ResourceSource
  publishedAt?: string
  updatedAt?: string
  cost?: string
  howTo?: string
  accessType?: string
  kind?: string
  relevanceScore: number
  searchText: string
  searchAliases?: string[]
  accessStatus?: ResourceAccessStatus
  accessNote?: string
  urlStatus?: string
  urlHttp?: string
  urlCheckedAt?: string
}
