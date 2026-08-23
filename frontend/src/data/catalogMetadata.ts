import type { ResourceCategoryId } from '@/domain/categories'

export const resourceCounts: Record<ResourceCategoryId, number> = {
  services: 363,
  learning: 193,
  research: 83,
  competition: 46,
  community: 209,
  life: 86,
  wellbeing: 156,
  future: 159,
  other: 0,
}

export const totalResourceCount = Object.values(resourceCounts).reduce((sum, count) => sum + count, 0)
