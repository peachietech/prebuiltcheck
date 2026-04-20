import { describe, it, expect, vi } from 'vitest'
import { fetchPageHtml } from './scrapingbee'

vi.stubGlobal('fetch', vi.fn())

describe('fetchPageHtml', () => {
  it('calls ScrapingBee API with correct params', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response('<html>test</html>', { status: 200 }))

    const html = await fetchPageHtml('https://www.bestbuy.com/product/123')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('app.scrapingbee.com/api/v1'),
      expect.any(Object)
    )
    expect(html).toBe('<html>test</html>')
  })

  it('throws on non-200 status', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response('blocked', { status: 429 }))
    await expect(fetchPageHtml('https://www.bestbuy.com/product/123')).rejects.toThrow('ScrapingBee error: 429')
  })
})
