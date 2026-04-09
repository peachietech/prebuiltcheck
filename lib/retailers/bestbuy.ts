import 'server-only'
import type { RetailerListing, PartType } from '@/types'

const API_BASE = 'https://api.bestbuy.com/v1/products'
const AFFILIATE_BASE = 'https://bestbuy.7tiv.net/c/'

/**
 * Product name patterns to exclude — avoids prebuilt desktops, laptops,
 * car accessories, and other irrelevant results from component searches.
 * NOTE: "all-in-one" is intentionally scoped to desktop/pc/computer so we
 * do NOT accidentally exclude AIO liquid CPU coolers (e.g. "Kraken 240 All-in-One").
 */
const EXCLUDE_PATTERN =
  /gaming desktop|prebuilt|gaming pc tower|all-in-one (?:desktop|pc\b|computer)|mini pc|dash kit|car |vehicle|laptop|notebook|sodimm/i

/**
 * Build a Best Buy search query optimised per part type.
 * memoryType ('DDR4' | 'DDR5') is used for motherboard searches to ensure
 * the returned board is compatible with the build's RAM generation.
 */
function buildQuery(name: string, type: PartType, memoryType?: string): string {
  switch (type) {
    case 'cpu': {
      // "Intel Core i7 14700F" → "Core i7-14700F processor"
      const model = name.match(/(?:Core\s+\w[\w-]*(?:\s+\d+\w+)?|Ryzen\s+\d+\s+\d+\w*)/i)
      return model ? `${model[0]} processor` : `${name} processor`
    }
    case 'gpu': {
      // Preserve suffixes: "RX 9070 XT", "RTX 4070 Ti Super", "RTX 5060 12GB"
      const model = name.match(/(?:RTX|GTX|RX)\s+\d{3,4}\s*(?:Ti\s+Super|Ti|Super|XT)?\s*(?:\d+\s*GB)?/i)
      return model ? `${model[0].trim()} graphics card` : `${name} graphics card`
    }
    case 'memory': {
      // Include speed when available — narrows results to the right tier and avoids
      // server/workstation RAM kits that match the same size/gen at wildly inflated prices.
      const size = name.match(/\d+GB/i)?.[0] ?? '16GB'
      const gen = name.match(/DDR[45]/i)?.[0] ?? 'DDR5'
      const speed = name.match(/(\d{4,5})(?:\s*MHz)?/i)?.[1]
      return speed
        ? `${gen} ${size} ${speed} desktop memory`
        : `${gen} ${size} desktop memory`
    }
    case 'storage': {
      // Use "M2" (no period) for Best Buy — the period in "M.2" can confuse
      // Best Buy's query parser since their API uses dot notation internally.
      const size = name.match(/\d+(?:TB|GB)/i)?.[0] ?? '1TB'
      return /nvme/i.test(name) ? `${size} NVMe M2 SSD` : `${size} SATA SSD`
    }
    case 'motherboard': {
      // Include DDR gen to ensure RAM compatibility (DDR4 ≠ DDR5 slots).
      const chipset = name.match(/\b[BZHXA]\d{3}[A-Z]*/i)?.[0]
      const socket = name.match(/LGA\d{4}|AM[45]/i)?.[0]
      const ddr = memoryType ?? name.match(/DDR[45]/i)?.[0] ?? ''
      if (chipset && socket) return `${chipset} ${socket} ${ddr} motherboard`.replace(/\s+/g, ' ').trim()
      if (chipset) return `${chipset} ${ddr} motherboard`.replace(/\s+/g, ' ').trim()
      return `${name.split(/\s+/).slice(0, 3).join(' ')} motherboard`
    }
    case 'psu': {
      // Drop "ATX" — Best Buy sometimes indexes as "power supply" without the form factor.
      // Use watt value only so we cast a wider net.
      const w = name.match(/(\d+)\s*W/i)?.[1] ?? '650'
      return `${w} watt power supply`
    }
    case 'cooling': {
      if (/liquid|aio|water/i.test(name)) {
        const mm = name.match(/\d+mm/i)?.[0] ?? '240mm'
        return `${mm} AIO liquid CPU cooler`
      }
      return 'CPU air cooler heatsink 120mm'
    }
    case 'case': {
      if (/full.?tower/i.test(name)) return 'full tower ATX PC case'
      if (/mini.?itx/i.test(name)) return 'mini ITX PC case'
      return 'ATX mid tower PC case'
    }
  }
}

/**
 * Broader fallback query used when the primary search returns no products.
 * Strips type-specific keywords down to the bare minimum so something always
 * comes back for generic parts like cases, storage, and motherboards.
 */
function buildFallbackQuery(name: string, type: PartType): string {
  switch (type) {
    case 'storage': {
      const size = name.match(/\d+(?:TB|GB)/i)?.[0] ?? '1TB'
      return /nvme/i.test(name) ? `${size} M2 NVMe SSD` : `${size} SSD`
    }
    case 'motherboard': {
      const chipset = name.match(/\b[BZHXA]\d{3}[A-Z]*/i)?.[0]
      return chipset ? `${chipset} motherboard` : 'ATX motherboard'
    }
    case 'case':
      return 'ATX PC case'
    case 'cooling':
      return 'CPU cooler'
    case 'psu': {
      const w = name.match(/\d+W/i)?.[0] ?? '650W'
      return `${w} power supply`
    }
    default:
      // For CPU/GPU/memory the primary query is already specific — use name
      return name
  }
}

async function fetchProducts(query: string, apiKey: string) {
  const params = new URLSearchParams({
    apiKey,
    show: 'name,regularPrice,salePrice,sku,url',
    pageSize: '8',
    format: 'json',
  })

  const res = await fetch(`${API_BASE}(search=${encodeURIComponent(query)})?${params}`)
  if (!res.ok) return []

  const data = await res.json()
  return (data.products ?? []) as Array<{
    name: string
    regularPrice: number
    salePrice: number | null
    sku: number
    url: string
  }>
}

export async function searchBestBuy(
  name: string,
  type?: PartType,
  memoryType?: string
): Promise<RetailerListing | null> {
  const apiKey = process.env.BESTBUY_API_KEY
  if (!apiKey) return null

  const primaryQuery = type ? buildQuery(name, type, memoryType) : name
  let products = await fetchProducts(primaryQuery, apiKey)

  // If primary query found nothing, try a simpler fallback query
  if (!products.length && type) {
    products = await fetchProducts(buildFallbackQuery(name, type), apiKey)
  }

  if (!products.length) return null

  // Prefer filtered results (exclude prebuilts/laptops), but fall back to the
  // best-priced unfiltered result so we always return something useful.
  const filtered = products.filter(p => !EXCLUDE_PATTERN.test(p.name))
  const candidates = filtered.length ? filtered : products

  // Pick the lowest-priced candidate rather than always taking index 0
  const product = candidates.reduce((best, cur) => {
    const bestPrice = best.salePrice ?? best.regularPrice ?? Infinity
    const curPrice = cur.salePrice ?? cur.regularPrice ?? Infinity
    return curPrice < bestPrice ? cur : best
  })

  const price = product.salePrice ?? product.regularPrice
  if (!price) return null

  // product.url can be absolute ("https://www.bestbuy.com/site/...") or
  // relative ("/site/...") depending on API version — handle both.
  const productUrl = product.url.startsWith('http')
    ? product.url
    : `https://www.bestbuy.com${product.url}`

  const tag = process.env.BESTBUY_AFFILIATE_TAG ?? ''
  const affiliateUrl = tag
    ? `${AFFILIATE_BASE}${tag}?u=${encodeURIComponent(productUrl)}`
    : productUrl

  return { retailer: 'bestbuy', price, name: product.name, affiliateUrl }
}
