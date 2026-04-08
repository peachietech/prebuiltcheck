import { describe, it, expect, vi, beforeEach } from 'vitest'
import { findCachedComparison } from './dedup'

const mockSelect = vi.fn()
const mockFrom = vi.fn(() => ({ select: mockSelect }))
vi.mock('@/lib/supabase', () => ({
  createServerClient: () => ({ from: mockFrom }),
}))

describe('findCachedComparison', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns slug when URL was scraped within 24 hours', async () => {
    mockSelect.mockResolvedValueOnce({
      data: [{ slug: 'abc12345', created_at: new Date().toISOString() }],
      error: null,
    })
    const result = await findCachedComparison('https://bestbuy.com/product/123')
    expect(result).toBe('abc12345')
  })

  it('returns null when no recent comparison exists', async () => {
    mockSelect.mockResolvedValueOnce({ data: [], error: null })
    const result = await findCachedComparison('https://bestbuy.com/product/999')
    expect(result).toBeNull()
  })
})
