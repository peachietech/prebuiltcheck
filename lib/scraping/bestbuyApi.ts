// Fetches Best Buy product details via the Products API — no scraping needed.
// Much faster and more reliable than browser rendering for Best Buy URLs.

import type { ParsedListing } from './parsers/index'
import type { ExtractedPart } from '@/types'

const PART_PATTERNS: { type: ExtractedPart['type']; patterns: RegExp[] }[] = [
  { type: 'cpu', patterns: [/intel core/i, /amd ryzen/i, /processor/i] },
  { type: 'gpu', patterns: [/nvidia geforce/i, /rtx \d+/i, /amd radeon/i, /rx \d+/i, /\bgpu\b/i] },
  { type: 'memory', patterns: [/\bddr[45]\b/i, /\bram\b/i, /gb.*memory/i] },
  { type: 'storage', patterns: [/\bnvme\b/i, /\bssd\b/i, /\bhdd\b/i, /tb.*storage/i, /gb.*storage/i] },
  { type: 'motherboard', patterns: [/motherboard/i, /\bmobo\b/i] },
  { type: 'psu', patterns: [/power supply/i, /\bpsu\b/i, /\d+w\b/i] },
  { type: 'case', patterns: [/\bcase\b/i, /mid tower/i, /full tower/i, /atx.*chassis/i] },
  { type: 'cooling', patterns: [/cooler/i, /\baio\b/i, /liquid cool/i, /\bfan\b/i] },
]

function classifyLine(text: string): ExtractedPart['type'] | null {
  for (const { type, patterns } of PART_PATTERNS) {
    if (patterns.some(p => p.test(text))) return type
  }
  return null
}

// Numeric SKU only — /site/name/1234567.p or /site/name/1234567
function extractNumericSku(url: string): string | null {
  const match = url.match(/\/(\d{7,8})(?:\.p)?(?:[?#]|$)/)
  return match ? match[1] : null
}

// Build a search query from the URL slug
// e.g. ibuypower-slate-mesh-gaming-desktop-pc-intel-core-i7-14700f-...
// → "ibuypower intel i7-14700f rtx 4060 gaming desktop"
function searchQueryFromSlug(url: string): string {
  const segments = new URL(url).pathname.split('/').filter(Boolean)
  // Second-to-last is the slug, last is the product ID
  const slug = segments.length >= 2 ? segments[segments.length - 2] : segments[0] ?? ''
  return slug.replace(/-/g, ' ').slice(0, 100)
}

async function fetchByQuery(query: string, apiKey: string): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({
    apiKey,
    format: 'json',
    show: 'name,regularPrice,salePrice,images,features',
    pageSize: '1',
  })
  const res = await fetch(
    `https://api.bestbuy.com/v1/products(search=${encodeURIComponent(query)})?${params}`
  )
  if (!res.ok) throw new Error(`Best Buy API error: ${res.status}`)
  const data = await res.json()
  return data.products?.[0] ?? null
}

async function fetchBySku(sku: string, apiKey: string): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({
    apiKey,
    format: 'json',
    show: 'name,regularPrice,salePrice,images,features',
    pageSize: '1',
  })
  const res = await fetch(`https://api.bestbuy.com/v1/products(sku=${sku})?${params}`)
  if (!res.ok) return null // fall through to search
  const data = await res.json()
  return data.products?.[0] ?? null
}

export async function fetchBestBuyProduct(url: string): Promise<ParsedListing> {
  const apiKey = process.env.BESTBUY_API_KEY!
  const sku = extractNumericSku(url)

  // Try numeric SKU first, fall back to name search
  let product: Record<string, unknown> | null = null
  if (sku) {
    product = await fetchBySku(sku, apiKey)
  }
  if (!product) {
    const query = searchQueryFromSlug(url)
    product = await fetchByQuery(query, apiKey)
  }

  if (!product) throw new Error('Product not found in Best Buy catalog')

  const prebuiltName = (product.name as string) ?? 'Unknown Product'
  const prebuiltPrice = (product.salePrice ?? product.regularPrice ?? null) as number | null
  const images = product.images as Array<{ href: string }> | undefined
  const prebuiltImageUrl = images?.[0]?.href ?? null

  const parts: ExtractedPart[] = []
  const seen = new Set<ExtractedPart['type']>()

  const features = product.features as Array<{ feature: string }> | undefined
  for (const feature of features ?? []) {
    const text = feature.feature ?? ''
    const type = classifyLine(text)
    if (type && !seen.has(type)) {
      parts.push({ type, name: text })
      seen.add(type)
    }
  }

  return { prebuiltName, prebuiltPrice, prebuiltImageUrl, retailer: 'bestbuy', parts }
}
