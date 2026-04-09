import type { RetailerListing, PartType } from '@/types'

// Return null immediately if Walmart credentials are not configured
function isConfigured(): boolean {
  return !!(process.env.WALMART_CLIENT_ID && process.env.WALMART_CLIENT_SECRET)
}

/**
 * Build a Walmart search query optimised per part type.
 * Generic enough that Walmart's broad catalog can surface a result,
 * specific enough to avoid totally wrong categories.
 */
function buildQuery(name: string, type: PartType, memoryType?: string): string {
  switch (type) {
    case 'cpu': {
      const model = name.match(/(?:Core\s+\w[\w-]*(?:\s+\d+\w+)?|Ryzen\s+\d+\s+\d+\w*)/i)
      return model ? `${model[0]} processor` : `${name} processor`
    }
    case 'gpu': {
      const model = name.match(/(?:RTX|GTX|RX)\s+\d{3,4}\s*(?:Ti\s+Super|Ti|Super|XT)?\s*(?:\d+\s*GB)?/i)
      return model ? `${model[0].trim()} graphics card` : `${name} graphics card`
    }
    case 'memory': {
      const size = name.match(/\d+GB/i)?.[0] ?? '16GB'
      const gen = name.match(/DDR[45]/i)?.[0] ?? 'DDR5'
      return `${gen} ${size} desktop memory`
    }
    case 'storage': {
      const size = name.match(/\d+(?:TB|GB)/i)?.[0] ?? '1TB'
      return /nvme/i.test(name) ? `${size} NVMe SSD` : `${size} SATA SSD`
    }
    case 'motherboard': {
      const chipset = name.match(/\b[BZHXA]\d{3}[A-Z]*/i)?.[0]
      const ddr = memoryType ?? name.match(/DDR[45]/i)?.[0] ?? ''
      return chipset ? `${chipset} ${ddr} motherboard`.trim() : `${name.split(/\s+/).slice(0, 3).join(' ')} motherboard`
    }
    case 'psu': {
      const w = name.match(/(\d+)\s*W/i)?.[1] ?? '650'
      return `${w} watt power supply`
    }
    case 'cooling': {
      if (/liquid|aio|water/i.test(name)) {
        const mm = name.match(/\d+mm/i)?.[0] ?? '240mm'
        return `${mm} liquid CPU cooler`
      }
      return 'CPU air cooler'
    }
    case 'case':
      return 'ATX mid tower PC case'
  }
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

export async function searchWalmart(
  name: string,
  type?: PartType,
  memoryType?: string
): Promise<RetailerListing | null> {
  if (!isConfigured()) return null

  const query = type ? buildQuery(name, type, memoryType) : name

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
