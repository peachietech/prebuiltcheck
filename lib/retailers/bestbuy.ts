import 'server-only'
import type { RetailerListing, PartType } from '@/types'

const API_BASE = 'https://api.bestbuy.com/v1/products'
const AFFILIATE_BASE = 'https://bestbuy.7tiv.net/c/'

/**
 * Best Buy category IDs for PC components.
 * Filtering by categoryId prevents desktop PCs from appearing when
 * searching for a CPU, GPU, etc.
 */
const CATEGORY_IDS: Partial<Record<PartType, string>> = {
  cpu:         'abcat0507002', // Processors
  gpu:         'abcat0507005', // Video Cards
  memory:      'abcat0511000', // Computer Memory
  storage:     'abcat0504000', // Hard Drives & SSDs
  motherboard: 'abcat0507010', // Motherboards
  psu:         'pcmcat167900050008', // Power Supplies
  cooling:     'pcmcat346800050003', // CPU Cooling
  case:        'pcmcat167900050014', // PC Cases
}

/**
 * Trim search query to keywords Best Buy handles well.
 * Removes socket suffixes (LGA1700), MHz specs, and brand-specific jargon.
 */
function simplifyQuery(name: string, type: PartType): string {
  switch (type) {
    case 'cpu': {
      // "Intel Core i7 14700F" → "Core i7-14700F"
      const m = name.match(/(?:Intel\s+)?Core\s+\w[\w-]*|AMD\s+Ryzen\s+\d+\s+\d+\w*/i)
      return m ? m[0] : name.split(/\s+/).slice(0, 4).join(' ')
    }
    case 'gpu': {
      // "NVIDIA GeForce RTX 4060 8GB" → "RTX 4060 8GB"
      const m = name.match(/(?:RTX|GTX|RX)\s+\d+(?:\s+Ti)?(?:\s+\d+GB)?/i)
      return m ? m[0] : name.split(/\s+/).slice(0, 5).join(' ')
    }
    case 'memory': {
      // "32GB DDR5 5200MHz" → "32GB DDR5"
      return name.replace(/\d{4,5}\s*MHz/i, '').replace(/RGB/i, '').trim()
    }
    case 'storage': {
      // "1TB NVMe SSD" → "1TB NVMe SSD M.2"
      const m = name.match(/\d+(?:TB|GB)\s+(?:NVMe|SATA)?\s*(?:SSD|HDD)?/i)
      return m ? m[0] + ' M.2' : name
    }
    case 'motherboard': {
      // "Intel B760 ATX motherboard LGA1700" → "B760 motherboard"
      const chipset = name.match(/\b[BZHXA]\d{3}[A-Z]*/i)
      return chipset ? `${chipset[0]} motherboard` : name.split(/\s+/).slice(0, 3).join(' ')
    }
    case 'psu': {
      // "600W power supply" → "600W power supply modular"
      const w = name.match(/\d+W/i)
      return w ? `${w[0]} power supply` : name
    }
    case 'cooling': {
      // "CPU air cooler" → "CPU cooler heatsink"
      if (/air/i.test(name)) return 'CPU air cooler heatsink'
      const mm = name.match(/\d+mm/i)
      return mm ? `${mm[0]} AIO liquid cooler` : 'CPU cooler'
    }
    case 'case': {
      // "iBUYPOWER Slate mid tower case" → "ATX mid tower case"
      if (/mid.?tower/i.test(name)) return 'ATX mid tower case'
      if (/full.?tower/i.test(name)) return 'full tower case ATX'
      if (/mini.?itx/i.test(name)) return 'mini ITX case'
      return 'ATX mid tower case'
    }
  }
}

export async function searchBestBuy(
  name: string,
  type?: PartType
): Promise<RetailerListing | null> {
  const apiKey = process.env.BESTBUY_API_KEY
  if (!apiKey) return null

  const query = type ? simplifyQuery(name, type) : name
  const categoryId = type ? CATEGORY_IDS[type] : undefined

  // Build the filter: category-scoped search when we know the type
  const filter = categoryId
    ? `(categoryId=${categoryId}&search=${encodeURIComponent(query)})`
    : `(search=${encodeURIComponent(query)})`

  const params = new URLSearchParams({
    apiKey,
    show: 'name,regularPrice,salePrice,sku,url,categoryPath',
    pageSize: '5',
    format: 'json',
  })

  const res = await fetch(`${API_BASE}${filter}?${params}`)
  if (!res.ok) return null

  const data = await res.json()
  const products: Array<{
    name: string
    regularPrice: number
    salePrice: number
    sku: number
    url: string
    categoryPath?: Array<{ name: string }>
  }> = data.products ?? []

  if (!products.length) return null

  // For non-category-scoped searches, exclude obvious prebuilts
  const PREBUILT_PATTERN = /gaming desktop|prebuilt|desktop pc|gaming pc tower/i
  const filtered = categoryId
    ? products
    : products.filter(p => {
        const cats = p.categoryPath?.map(c => c.name).join(' ') ?? ''
        return !PREBUILT_PATTERN.test(cats) && !PREBUILT_PATTERN.test(p.name)
      })

  const product = filtered[0] ?? products[0]
  const price = product.salePrice ?? product.regularPrice
  if (!price) return null

  const productUrl = `https://www.bestbuy.com${product.url}`
  const tag = process.env.BESTBUY_AFFILIATE_TAG ?? ''
  const affiliateUrl = tag
    ? `${AFFILIATE_BASE}${tag}/${encodeURIComponent(productUrl)}`
    : productUrl

  return { retailer: 'bestbuy', price, name: product.name, affiliateUrl }
}
