/**
 * Lighter ScrapingBee request for search result pages.
 * Uses a premium proxy (bypasses Cloudflare) but skips JS rendering
 * to keep credit cost low. Falls back gracefully — callers should catch.
 */
export async function fetchSearchHtml(url: string): Promise<string> {
  const params = new URLSearchParams({
    api_key: process.env.SCRAPINGBEE_API_KEY ?? '',
    url,
    render_js: 'false',
    premium_proxy: 'true',
    block_resources: 'true',
    timeout: '15000',
  })

  const controller = new AbortController()
  const hardTimeout = setTimeout(() => controller.abort(), 18000)

  try {
    const response = await fetch(`https://app.scrapingbee.com/api/v1?${params}`, {
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`ScrapingBee error: ${response.status}`)
    return response.text()
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Search page fetch timed out')
    }
    throw err
  } finally {
    clearTimeout(hardTimeout)
  }
}

export async function fetchPageHtml(url: string): Promise<string> {
  const params = new URLSearchParams({
    api_key: process.env.SCRAPINGBEE_API_KEY!,
    url,
    render_js: 'true',
    premium_proxy: 'true',
    block_resources: 'true', // Skip images/CSS/fonts — cuts render time significantly
    wait: '500',             // Wait 500ms for JS to settle, then grab HTML
    timeout: '25000',        // Tell ScrapingBee to cap at 25s on their end
  })

  const controller = new AbortController()
  const hardTimeout = setTimeout(() => controller.abort(), 28000) // 28s client-side cap

  try {
    const response = await fetch(`https://app.scrapingbee.com/api/v1?${params}`, {
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`ScrapingBee error: ${response.status}`)
    }

    return response.text()
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Scraping timed out — please try again')
    }
    throw err
  } finally {
    clearTimeout(hardTimeout)
  }
}
