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

// Best Buy API "details" field: [{name: "Processor Chipset", value: "B760"}, ...]
type BestBuyDetail = { name: string; value: string }

// Look up a spec by name in the details array (case-insensitive partial match)
function getDetail(details: BestBuyDetail[], ...keys: string[]): string | null {
  for (const key of keys) {
    const found = details.find(d => d.name.toLowerCase().includes(key.toLowerCase()))
    if (found?.value) return found.value.trim()
  }
  return null
}

// Extract a meaningful series/model name from the prebuilt product title.
// "iBUYPOWER Slate MR Gaming Desktop…" → "Slate"
// "CyberPowerPC Gamer Xtreme VR Gaming PC" → "Gamer Xtreme"
// "HP OMEN 45L Gaming Desktop" → "OMEN 45L"
function extractCaseSeries(productName: string, brandName: string): string | null {
  // Strip known brand prefixes (case-insensitive) then grab the next 1-2 word tokens
  const escaped = brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const stripped = productName.replace(new RegExp(escaped, 'i'), '').trim()

  // Skip common filler words at the start
  const fillers = /^(gaming|desktop|pc|tower|prebuilt|system|series|edition)\b/i
  const tokens = stripped.split(/\s+/).filter(t => !fillers.test(t))

  // Take up to 2 meaningful tokens (at least 3 chars each, not pure punctuation)
  const series = tokens.filter(t => t.length >= 3 && /[a-z]/i.test(t)).slice(0, 2).join(' ')
  return series.length >= 3 ? series : null
}

const FIELD_LIST = 'name,regularPrice,salePrice,images,features,details,manufacturer,modelNumber'

async function fetchByQuery(query: string, apiKey: string): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({
    apiKey,
    format: 'json',
    show: FIELD_LIST,
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
    show: FIELD_LIST,
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
  const manufacturer = (product.manufacturer as string) ?? ''

  // Parse spec-table details for chipset, cooler type, etc.
  const details = (product.details as BestBuyDetail[] | undefined) ?? []

  const chipset = getDetail(details, 'chipset', 'processor chipset')
  const coolerType = getDetail(details, 'cooling', 'cooler type', 'cpu cooler')

  const parts: ExtractedPart[] = []
  const seen = new Set<ExtractedPart['type']>()

  // --- Feature list: CPU, GPU, memory, storage ---
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

  // --- Specs section: motherboard chipset ---
  if (!seen.has('motherboard') && chipset) {
    // Map chipset code → full search term
    const moboName = resolveMotherboardFromChipset(chipset)
    if (moboName) {
      parts.push({ type: 'motherboard', name: moboName })
      seen.add('motherboard')
    }
  }

  // --- Specs section: cooler type ---
  if (!seen.has('cooling') && coolerType) {
    const coolerName = resolveCoolerName(coolerType, parts)
    if (coolerName) {
      parts.push({ type: 'cooling', name: coolerName })
      seen.add('cooling')
    }
  }

  // --- Case: infer from product title series name (marked suggested — user should confirm) ---
  if (!seen.has('case') && manufacturer) {
    const series = extractCaseSeries(prebuiltName, manufacturer)
    if (series) {
      parts.push({ type: 'case', name: `${manufacturer} ${series} case`, suggested: true })
      seen.add('case')
    }
  }

  // --- Smart suggestions for anything still missing ---
  const suggestions = suggestMissingParts(parts)
  parts.push(...suggestions)

  return { prebuiltName, prebuiltPrice, prebuiltImageUrl, retailer: 'bestbuy', parts }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveMotherboardFromChipset(chipset: string): string | null {
  const c = chipset.toUpperCase().trim()

  // Intel chipsets (LGA1700 — 12th/13th/14th gen)
  if (/^Z[679]\d0/.test(c)) return `Intel ${c} ATX motherboard LGA1700`
  if (/^H[67]\d0/.test(c)) return `Intel ${c} ATX motherboard LGA1700`
  if (/^B[67]\d0/.test(c)) return `Intel ${c} ATX motherboard LGA1700`

  // Intel LGA1851 (Arrow Lake)
  if (/^Z8\d0/.test(c)) return `Intel ${c} ATX motherboard LGA1851`
  if (/^B8\d0/.test(c)) return `Intel ${c} ATX motherboard LGA1851`

  // AMD AM5 (Ryzen 7000/9000)
  if (/^X[67]\d0/.test(c)) return `AMD ${c} ATX motherboard AM5`
  if (/^B[67]\d0/.test(c)) return `AMD ${c} ATX motherboard AM5`
  if (/^A[67]\d0/.test(c)) return `AMD ${c} ATX motherboard AM5`

  // AMD AM4 (Ryzen 5000 and older)
  if (/^X[45]\d0/.test(c)) return `AMD ${c} ATX motherboard AM4`
  if (/^B[45]\d0/.test(c)) return `AMD ${c} ATX motherboard AM4`
  if (/^A[45]\d0/.test(c)) return `AMD ${c} ATX motherboard AM4`

  // Unknown chipset — still better than nothing
  return `${chipset} motherboard`
}

function resolveCoolerName(coolerType: string, parts: ExtractedPart[]): string | null {
  const t = coolerType.toLowerCase()
  const cpuName = parts.find(p => p.type === 'cpu')?.name ?? ''

  if (/liquid|aio|water/i.test(t)) {
    // Liquid cooler — pick size based on CPU tier
    if (/i9|ryzen\s*9/i.test(cpuName)) return '360mm AIO liquid cooler'
    if (/i7|ryzen\s*7/i.test(cpuName)) return '240mm AIO liquid cooler'
    return '240mm AIO liquid cooler'
  }

  if (/air|tower|fan/i.test(t)) {
    return 'CPU air cooler'
  }

  return null
}
