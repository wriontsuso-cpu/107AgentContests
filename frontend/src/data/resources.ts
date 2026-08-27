import { adaptResourceCollection } from './resourceAdapter'
import { mockResourceRows } from './mockResources'

export const resources = adaptResourceCollection(mockResourceRows)

export const resourceById = new Map(resources.map((resource) => [resource.id, resource]))
