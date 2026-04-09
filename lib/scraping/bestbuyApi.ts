import type { ParsedListing } from './parsers/index'
import type { ExtractedPart } from '@/types'
import { cleanPartName, suggestMissingParts } from './partUtils'

const PART_PATTERNS: { type: ExtractedPart['type']; patterns: RegExp[] }[] = [
  { type: 'cpu', patterns: [/intel core/i, /amd ryzen/i, /processor/i] },
  { type: 'gpu', patterns: [/nvidia geforce/i, /rtx \d+/i, /amd radeon/i, /rx \d+/i, /\bgpu\b/i] },
  { type: 'memory', patterns: [/\bddr[45]\b/i, /\bram\b/i, /gb.*memory/i] },
  { type: 'storage', patterns: [/\bnvme\b/i, /\bssd\b/i, /\bhdd\b/i, /tb.*storage/i, /gb.*storage/i] },
  { type: 'motherboard', patterns: [/motherboard/i, /\bmobo\b/i] },
  { type: 'psu', patterns: [/power supply/i, /\bpsu\b/i, /\d+\s*w\b.*power/i] },
  { type: 'case', patterns: [/\bcase\b/i, /mid.?tower/i, /full.?tower/i, /atx.*chassis/i] },
  { type: 'cooling', patterns: [/cooler/i, /\baio\b/i, /liquid cool/i] },
]

function classifyLine(text: string): ExtractedPart['type'] | null {
  for (const { type, patterns } of PART_PATTERNS) {
    if (patterns.some(p => p.test(text))) return type
  }
  return null
}

function extractNumericSku(url: string): string | null {
  const match = url.match(/\/(\d{7,8})(?:\.p)?(?:[?#]|$)/)
  return match ? match[1] : null
}

function searchQueryFromSlug(url: string): string {
  const segments = new URL(url).pathname.split('/').filter(Boolean)
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
  if (!res.ok) return null
  const data = await res.json()
  return data.products?.[0] ?? null
}

export async function fetchBestBuyProduct(url: string): Promise<ParsedListing> {
  const apiKey = process.env.BESTBUY_API_KEY!
  const sku = extractNumericSku(url)

  let product: Record<string, unknown> | null = null
  if (sku) product = await fetchBySku(sku, apiKey)
  if (!product) product = await fetchByQuery(searchQueryFromSlug(url), apiKey)
  if (!product) throw new Error('Product not found in Best Buy catalog')

  const prebuiltName = (product.name as string) ?? 'Unknown Product'
  const prebuiltPrice = (product.salePrice ?? product.regularPrice ?? null) as number | null
  const images = product.images as Array<{ href: string }> | undefined
  const prebuiltImageUrl = images?.[0]?.href ?? null

  const parts: ExtractedPart[] = []
  const seen = new Set<ExtractedPart['type']>()

  const features = product.features as Array<{ feature: string }> | undefined
  for (const feature of features ?? []) {
    const rawText = feature.feature ?? ''
    const type = classifyLine(rawText)
    if (type && !seen.has(type)) {
      const name = cleanPartName(rawText, type)
      parts.push({ type, name })
      seen.add(type)
    }
  }

  // Add smart suggestions for any parts not found in the listing
  const suggestions = suggestMissingParts(parts)
  parts.push(...suggestions)

  return { prebuiltName, prebuiltPrice, prebuiltImageUrl, retailer: 'bestbuy', parts }
}
