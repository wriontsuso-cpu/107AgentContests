import metadata from './raw/catalogMetadata.json'
import { CATEGORY_IDS, type ResourceCategoryId } from '@/domain/categories'

export const resourceCounts = Object.fromEntries(
  CATEGORY_IDS.map((category) => [category, metadata.counts[category]]),
) as Record<ResourceCategoryId, number>

export const totalResourceCount = metadata.total
export const catalogGeneratedAt = metadata.generatedAt
