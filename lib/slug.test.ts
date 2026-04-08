import { describe, it, expect } from 'vitest'
import { generateSlug } from './slug'

describe('generateSlug', () => {
  it('returns an 8-character string', () => {
    const slug = generateSlug()
    expect(slug).toHaveLength(8)
  })

  it('returns URL-safe characters only', () => {
    for (let i = 0; i < 50; i++) {
      const slug = generateSlug()
      expect(slug).toMatch(/^[a-zA-Z0-9]+$/)
    }
  })

  it('generates unique values', () => {
    const slugs = new Set(Array.from({ length: 100 }, generateSlug))
    expect(slugs.size).toBe(100)
  })
})
