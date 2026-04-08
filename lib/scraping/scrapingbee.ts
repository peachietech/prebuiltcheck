export async function fetchPageHtml(url: string): Promise<string> {
  const params = new URLSearchParams({
    api_key: process.env.SCRAPINGBEE_API_KEY!,
    url,
    render_js: 'true',
    premium_proxy: 'true',
  })

  const response = await fetch(`https://app.scrapingbee.com/api/v1?${params}`, {})

  if (!response.ok) {
    throw new Error(`ScrapingBee error: ${response.status}`)
  }

  return response.text()
}
