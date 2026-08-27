import type { Resource } from '@/domain/resource'
import { adaptResourceCollection } from './resourceAdapter'

let localCatalog: Promise<Resource[]> | undefined

export function loadLocalCatalog(): Promise<Resource[]> {
  localCatalog ??= import('./raw/resources.json')
    .then((module) => adaptResourceCollection(module.default))

  return localCatalog
}
