import 'server-only'
import type { RetailerListing, PartType } from '@/types'

const API_BASE = 'https://api.bestbuy.com/v1/products'
const AFFILIATE_BASE = 'https://bestbuy.7tiv.net/c/'

/**
 * Product name patterns to exclude — avoids prebuilt desktops, laptops,
 * car accessories, and other irrelevant results from component searches.
 */
const EXCLUDE_PATTERN =
  /gaming desktop|prebuilt|gaming pc tower|all-in-one|mini pc|dash kit|car |vehicle|laptop|notebook|sodimm/i

/**
 * Build a Best Buy search query optimised per part type.
 * Generic queries like "32GB DDR5 5200MHz" return car stereo kits.
 * Specific keywords steer Best Buy toward the correct component category.
 */
function buildQuery(name: string, type: PartType): string {
  switch (type) {
    case 'cpu': {
      // "Intel Core i7 14700F" → "Core i7-14700F processor"
      const model = name.match(/(?:Core\s+\w[\w-]*(?:\s+\d+\w+)?|Ryzen\s+\d+\s+\d+\w*)/i)
      return model ? `${model[0]} processor` : `${name} processor`
    }
    case 'gpu': {
      // "NVIDIA GeForce RTX 4060 8GB" → "RTX 4060 8GB graphics card"
      const model = name.match(/(?:RTX|GTX|RX)\s+\d+(?:\s+Ti)?(?:\s+\d+GB)?/i)
      return model ? `${model[0]} graphics card` : `${name} graphics card`
    }
    case 'memory': {
      // "32GB DDR5 5200MHz" → "DDR5 32GB UDIMM" (UDIMM = desktop module, avoids laptop SODIMMs)
      const size = name.match(/\d+GB/i)?.[0] ?? '16GB'
      const gen = name.match(/DDR[45]/i)?.[0] ?? 'DDR5'
      return `${gen} ${size} UDIMM`
    }
    case 'storage': {
      // "1TB NVMe SSD" → "1TB NVMe M.2 SSD internal"
      const size = name.match(/\d+(?:TB|GB)/i)?.[0] ?? '1TB'
      const iface = /nvme/i.test(name) ? 'NVMe M.2' : 'SATA'
      return `${size} ${iface} SSD internal`
    }
    case 'motherboard': {
      // "Intel B760 ATX motherboard LGA1700" → "B760 Intel LGA1700 motherboard"
      const chipset = name.match(/\b[BZHXA]\d{3}[A-Z]*/i)?.[0]
      const socket = name.match(/LGA\d{4}|AM[45]/i)?.[0]
      if (chipset && socket) return `${chipset} ${socket} motherboard`
      if (chipset) return `${chipset} Intel motherboard`
      return `${name.split(/\s+/).slice(0, 3).join(' ')} motherboard`
    }
    case 'psu': {
      // "600W power supply" → "600W ATX power supply"
      const w = name.match(/\d+W/i)?.[0] ?? '650W'
      return `${w} ATX power supply`
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
      return 'ATX mid tower PC gaming case'
    }
  }
}

export async function searchBestBuy(
  name: string,
  type?: PartType
): Promise<RetailerListing | null> {
  const apiKey = process.env.BESTBUY_API_KEY
  if (!apiKey) return null

  const query = type ? buildQuery(name, type) : name

  const params = new URLSearchParams({
    apiKey,
    show: 'name,regularPrice,salePrice,sku,url',
    pageSize: '8',
    format: 'json',
  })

  const res = await fetch(`${API_BASE}(search=${encodeURIComponent(query)})?${params}`)
  if (!res.ok) return null

  const data = await res.json()
  const products: Array<{
    name: string
    regularPrice: number
    salePrice: number | null
    sku: number
    url: string
  }> = data.products ?? []

  if (!products.length) return null

  // Filter out prebuilts, laptops, and obviously irrelevant categories
  const filtered = products.filter(p => !EXCLUDE_PATTERN.test(p.name))
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
