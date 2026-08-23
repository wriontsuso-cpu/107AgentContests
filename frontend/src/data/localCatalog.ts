import type { Resource } from '@/domain/resource'
import { adaptResourceCollection } from './resourceAdapter'
import { resources as sampleResources } from './resources'

let developmentCatalog: Promise<Resource[]> | undefined

export function loadLocalCatalog(): Promise<Resource[]> {
  if (!import.meta.env.DEV) return Promise.resolve(sampleResources)

  developmentCatalog ??= import('./raw/resources.json')
    .then((module) => adaptResourceCollection(module.default))

  return developmentCatalog
}
