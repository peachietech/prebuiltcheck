import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchAmazon } from './amazon'
import { searchBestBuy } from './bestbuy'
import { searchWalmart } from './walmart'

vi.stubGlobal('fetch', vi.fn())

describe('searchBestBuy', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a RetailerListing with affiliate URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      products: [{
        name: 'Intel Core i7-13700KF',
        regularPrice: 289.99,
        sku: '1234567',
        url: '/site/intel-core-i7/1234567.p',
      }]
    }), { status: 200 }))

    const result = await searchBestBuy('Intel i7-13700KF')
    expect(result).not.toBeNull()
    expect(result!.price).toBe(289.99)
    expect(result!.retailer).toBe('bestbuy')
    expect(result!.affiliateUrl).toContain('bestbuy.com')
  })

  it('returns null when no products found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ products: [] }), { status: 200 }))
    const result = await searchBestBuy('nonexistent part xyz')
    expect(result).toBeNull()
  })
})

describe('searchWalmart', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a RetailerListing with affiliate URL', async () => {
    // Walmart needs 2 fetch calls: one for token, one for search
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'test-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ name: 'Intel i7-13700KF', salePrice: 279.00, itemId: '999888777' }]
      }), { status: 200 }))

    const result = await searchWalmart('Intel i7-13700KF')
    expect(result).not.toBeNull()
    expect(result!.price).toBe(279.00)
    expect(result!.retailer).toBe('walmart')
  })
})
