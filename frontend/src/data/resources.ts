import rawData from './raw/resources.json'
import { CATEGORY_IDS, type ResourceCategoryId } from '@/domain/categories'
import { adaptResourceCollection } from './resourceAdapter'

export const resources = adaptResourceCollection(rawData)

export const resourceById = new Map(resources.map((resource) => [resource.id, resource]))

export const resourceCounts = Object.fromEntries(
  CATEGORY_IDS.map((category) => [
    category,
    resources.filter((resource) => resource.category === category).length,
  ]),
) as Record<ResourceCategoryId, number>
