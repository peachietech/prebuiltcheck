import { describe, it, expect, vi, beforeEach } from 'vitest'
import { findCachedComparison } from './dedup'

// Build a chainable mock that terminates with a Promise on .limit()
const mockLimit = vi.fn()
const chain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: mockLimit,
}
const mockFrom = vi.fn(() => chain)

vi.mock('@/lib/supabase', () => ({
  createServerClient: () => ({ from: mockFrom }),
}))

describe('findCachedComparison', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns slug when URL was scraped within 24 hours', async () => {
    mockLimit.mockResolvedValueOnce({
      data: [{ slug: 'abc12345', created_at: new Date().toISOString() }],
      error: null,
    })
    const result = await findCachedComparison('https://bestbuy.com/product/123')
    expect(result).toBe('abc12345')
  })

  it('returns null when no recent comparison exists', async () => {
    mockLimit.mockResolvedValueOnce({ data: [], error: null })
    const result = await findCachedComparison('https://bestbuy.com/product/999')
    expect(result).toBeNull()
  })
})
