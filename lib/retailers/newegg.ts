import 'server-only'
import { parse } from 'node-html-parser'
import { fetchSearchHtml } from '@/lib/scraping/scrapingbee'
import type { RetailerListing, PartType } from '@/types'

const SEARCH_BASE = 'https://www.newegg.com/p/pl'

/**
 * Build a Newegg search query per part type.
 * memoryType ('DDR4' | 'DDR5') is used for motherboard searches to ensure
 * the returned board is compatible with the build's RAM generation.
 */
function buildQuery(name: string, type: PartType, memoryType?: string): string {
  switch (type) {
    case 'cpu': {
      const model = name.match(/(?:Core\s+\w[\w-]*(?:\s+\d+\w+)?|Ryzen\s+\d+\s+\d+\w*)/i)
      return model ? `${model[0]} processor` : name
    }
    case 'gpu': {
      // Preserve suffixes: "RX 9070 XT", "RTX 4070 Ti Super", "RTX 5060 12GB"
      const model = name.match(/(?:RTX|GTX|RX)\s+\d{3,4}\s*(?:Ti\s+Super|Ti|Super|XT)?\s*(?:\d+\s*GB)?/i)
      return model ? `${model[0].trim()} graphics card` : `${name} graphics card`
    }
    case 'memory': {
      const size = name.match(/\d+GB/i)?.[0] ?? '16GB'
      const gen = name.match(/DDR[45]/i)?.[0] ?? 'DDR5'
      const speed = name.match(/\d{4}(?:MHz)?/i)?.[0]
      return speed ? `${gen} ${size} ${speed} desktop` : `${gen} ${size} desktop memory`
    }
    case 'storage': {
      const size = name.match(/\d+(?:TB|GB)/i)?.[0] ?? '1TB'
      return /nvme/i.test(name) ? `${size} NVMe M.2 SSD` : `${size} SATA SSD`
    }
    case 'motherboard': {
      const chipset = name.match(/\b[BZHXA]\d{3}[A-Z]*/i)?.[0]
      const socket = name.match(/LGA\d{4}|AM[45]/i)?.[0]
      const ddr = memoryType ?? name.match(/DDR[45]/i)?.[0] ?? ''
      if (chipset && socket) return `${chipset} ${socket} ${ddr} motherboard`.replace(/\s+/g, ' ').trim()
      if (chipset) return `${chipset} ${ddr} motherboard`.replace(/\s+/g, ' ').trim()
      return `${name.split(/\s+/).slice(0, 3).join(' ')} motherboard`
    }
    case 'psu': {
      const w = name.match(/\d+W/i)?.[0] ?? '650W'
      return `${w} ATX power supply`
    }
    case 'cooling': {
      if (/liquid|aio|water/i.test(name)) {
        const mm = name.match(/\d+mm/i)?.[0] ?? '240mm'
        return `${mm} AIO liquid CPU cooler`
      }
      return 'CPU air cooler heatsink'
    }
    case 'case': {
      if (/full.?tower/i.test(name)) return 'full tower ATX PC case'
      if (/mini.?itx/i.test(name)) return 'mini ITX PC case'
      return 'ATX mid tower PC case'
    }
  }
}

/**
 * Wrap a Newegg product URL in a Rakuten Advertising deep link.
 *
 * NEWEGG_RAKUTEN_ID  = your Rakuten publisher id (the `id=` value in deep links)
 * NEWEGG_RAKUTEN_MID = Newegg's merchant id on Rakuten (defaults to 45924)
 */
function buildAffiliateUrl(productUrl: string): string {
  const id = process.env.NEWEGG_RAKUTEN_ID
  if (!id) return productUrl
  const mid = process.env.NEWEGG_RAKUTEN_MID ?? '45924'
  return `https://click.linksynergy.com/deeplink?id=${encodeURIComponent(id)}&mid=${mid}&murl=${encodeURIComponent(productUrl)}`
}

/**
 * Newegg product listing exclusion patterns — filters out irrelevant results
 * (prebuilt desktops, laptops, accessories) the same way we do for Best Buy.
 */
const EXCLUDE_PATTERN =
  /gaming desktop|gaming pc|prebuilt|laptop|notebook|sodimm|barebones/i

/**
 * Extract a price in dollars from a Newegg item element.
 * Tries multiple selector patterns for resilience against markup changes.
 */
function extractPrice(item: ReturnType<typeof parse>): number {
  // Primary: split across <strong> (dollars) and <sup>/<span> (cents)
  const dollars = item.querySelector('.price-current strong')?.text.trim() ?? ''
  const cents = item.querySelector('.price-current sup')?.text.trim()
    ?? item.querySelector('.price-current span')?.text.trim()
    ?? '00'

  if (dollars) {
    const str = `${dollars.replace(/[^0-9]/g, '')}.${cents.replace(/\D/g, '').slice(0, 2).padStart(2, '0')}`
    const v = parseFloat(str)
    if (v > 0) return v
  }

  // Fallback: any element whose text looks like a dollar price in the item
  const priceEl = item.querySelector('[class*="price"] strong, [class*="price-current"]')
  const raw = priceEl?.text.replace(/[^0-9.]/g, '') ?? ''
  const v2 = parseFloat(raw)
  return v2 > 0 ? v2 : 0
}

export async function searchNewegg(
  name: string,
  type?: PartType,
  memoryType?: string
): Promise<RetailerListing | null> {
  if (!process.env.SCRAPINGBEE_API_KEY) return null

  const query = type ? buildQuery(name, type, memoryType) : name
  const params = new URLSearchParams({ d: query })
  const searchUrl = `${SEARCH_BASE}?${params}`

  let html: string
  try {
    html = await fetchSearchHtml(searchUrl)
  } catch {
    return null
  }

  const root = parse(html)

  // Each product on Newegg search results lives in an `.item-cell` container
  const items = root.querySelectorAll('.item-cell')
  if (!items.length) return null

  for (const item of items) {
    const titleEl = item.querySelector('.item-title')
    const productName = titleEl?.text.trim()
    if (!productName) continue
    if (EXCLUDE_PATTERN.test(productName)) continue

    const price = extractPrice(item)
    if (!price) continue

    // Product URL — href on the title link is a relative path like /p/N82E16...
    const relHref = titleEl?.getAttribute('href') ?? ''
    const productUrl = relHref.startsWith('http')
      ? relHref
      : `https://www.newegg.com${relHref}`

    return {
      retailer: 'newegg',
      price,
      name: productName,
      affiliateUrl: buildAffiliateUrl(productUrl),
    }
  }

  return null
}
