import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchAmazon } from './amazon'
import { searchBestBuy } from './bestbuy'
import { searchWalmart } from './walmart'

vi.stubGlobal('fetch', vi.fn())

describe('searchBestBuy', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a RetailerListing with affiliate URL', async () => {
    // Stub the API key so the guard passes
    process.env.BESTBUY_API_KEY = 'test-key'
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      products: [{
        name: 'Intel Core i7-13700KF',
        regularPrice: 289.99,
        salePrice: null,
        sku: 1234567,
        url: '/site/intel-core-i7/1234567.p',
        categoryPath: [{ name: 'Computers & Tablets' }, { name: 'Processors' }],
      }]
    }), { status: 200 }))

    const result = await searchBestBuy('Intel i7-13700KF', 'cpu')
    delete process.env.BESTBUY_API_KEY
    expect(result).not.toBeNull()
    expect(result!.price).toBe(289.99)
    expect(result!.retailer).toBe('bestbuy')
    expect(result!.affiliateUrl).toContain('bestbuy.com')
  })

  it('returns null when no products found', async () => {
    process.env.BESTBUY_API_KEY = 'test-key'
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ products: [] }), { status: 200 }))
    const result = await searchBestBuy('nonexistent part xyz', 'cpu')
    delete process.env.BESTBUY_API_KEY
    expect(result).toBeNull()
  })
})

describe('searchWalmart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Stub credentials so isConfigured() returns true in tests
    process.env.WALMART_CLIENT_ID = 'test-client-id'
    process.env.WALMART_CLIENT_SECRET = 'test-client-secret'
  })

  afterEach(() => {
    delete process.env.WALMART_CLIENT_ID
    delete process.env.WALMART_CLIENT_SECRET
  })

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

  it('returns null when credentials are not configured', async () => {
    delete process.env.WALMART_CLIENT_ID
    delete process.env.WALMART_CLIENT_SECRET
    const result = await searchWalmart('Intel i7-13700KF')
    expect(result).toBeNull()
  })
})
