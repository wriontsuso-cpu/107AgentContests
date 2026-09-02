import { describe, expect, it } from 'vitest'
import { detailPhotography, pageVisuals } from './pagePhotography'

describe('pageVisuals', () => {
  it('assigns distinct desktop canvases with traceable provenance', () => {
    const pageEntries = Object.values(pageVisuals)
    expect(new Set(pageEntries.map((entry) => entry.src)).size).toBe(pageEntries.length)
    expect(pageVisuals.home).toMatchObject({ src: '/brand/campus-hero.webp', kind: 'official' })
    expect(pageVisuals.resources).toMatchObject({ src: '/brand/home-campus-life-wide.webp', kind: 'stock' })
    expect(pageVisuals.assistant).toMatchObject({
      src: '/brand/assistant-clouds.webp',
      alt: '暖色夕照下的层叠云朵',
      kind: 'stock',
    })
    expect(pageVisuals.profile).toMatchObject({
      src: '/brand/profile-snow-barn.webp',
      alt: '雪原中的木屋实景',
      kind: 'stock',
    })
    expect(pageEntries.every((entry) => entry.src.endsWith('.webp'))).toBe(true)
    expect(new Set(Object.values(detailPhotography)).size).toBe(Object.values(detailPhotography).length)
  })
})
