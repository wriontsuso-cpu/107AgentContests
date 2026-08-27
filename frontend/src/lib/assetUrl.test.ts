import { describe, expect, it } from 'vitest'
import { joinBasePath } from './assetUrl'

describe('joinBasePath', () => {
  it('keeps public assets inside a GitHub Pages repository base path', () => {
    expect(joinBasePath('/107AgentContests/', '/brand/campus-hero.webp')).toBe('/107AgentContests/brand/campus-hero.webp')
    expect(joinBasePath('/', '/brand/campus-hero.webp')).toBe('/brand/campus-hero.webp')
  })
})
