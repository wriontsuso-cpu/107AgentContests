import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadLocalCatalog } from './localCatalog'

describe('loadLocalCatalog', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('keeps the complete catalog available in production builds', async () => {
    vi.stubEnv('DEV', false)

    const resources = await loadLocalCatalog()

    expect(resources).toHaveLength(1295)
  })
})
