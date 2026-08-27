import { describe, expect, it } from 'vitest'
import { detailPhotography, pageVisuals } from './pagePhotography'

describe('pageVisuals', () => {
  it('assigns distinct desktop canvases with traceable provenance', () => {
    const pageEntries = Object.values(pageVisuals)
    expect(new Set(pageEntries.map((entry) => entry.src)).size).toBe(pageEntries.length)
    expect(pageVisuals.home).toMatchObject({ src: '/brand/campus-hero.webp', kind: 'official' })
    expect(pageVisuals.resources).toMatchObject({ src: '/brand/home-campus-life-wide.webp', kind: 'stock' })
    expect(pageVisuals.profile.kind).toBe('generated')
    expect(pageVisuals.assistant.kind).toBe('generated')
    expect(pageEntries.every((entry) => entry.src.endsWith('.webp'))).toBe(true)
    expect(new Set(Object.values(detailPhotography)).size).toBe(Object.values(detailPhotography).length)
  })
})
