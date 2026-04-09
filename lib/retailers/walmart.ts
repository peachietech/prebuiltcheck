import type { RetailerListing } from '@/types'

// Return null immediately if Walmart credentials are not configured
function isConfigured(): boolean {
  return !!(process.env.WALMART_CLIENT_ID && process.env.WALMART_CLIENT_SECRET)
}

async function getWalmartToken(): Promise<string> {
  const credentials = Buffer.from(
    `${process.env.WALMART_CLIENT_ID}:${process.env.WALMART_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch('https://marketplace.walmartapis.com/v3/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'WM_SVC.NAME': 'Walmart Marketplace',
      'WM_QOS.CORRELATION_ID': crypto.randomUUID(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  const data = await res.json()
  return data.access_token
}

export async function searchWalmart(query: string): Promise<RetailerListing | null> {
  if (!isConfigured()) return null

  const token = await getWalmartToken()

  const params = new URLSearchParams({ query, numItems: '5' })
  const res = await fetch(`https://developer.api.walmart.com/api-proxy/service/affil/product/v2/search?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'WM_SVC.NAME': 'PrebuiltCheck',
      'WM_QOS.CORRELATION_ID': crypto.randomUUID(),
    },
  })

  if (!res.ok) return null
  const data = await res.json()
  const item = data.items?.[0]
  if (!item) return null

  const affiliateUrl = `https://goto.walmart.com/c/${process.env.WALMART_AFFILIATE_IMPACT_ID}?u=${encodeURIComponent(`https://www.walmart.com/ip/${item.itemId}`)}`

  return {
    retailer: 'walmart',
    price: item.salePrice,
    name: item.name,
    affiliateUrl,
  }
}
