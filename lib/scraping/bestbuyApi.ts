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

// Best Buy API "details" field — confirmed real field names from live API:
// { name: "Motherboard Model Number", value: "B760 D5" }
// { name: "CPU Cooling System",       value: "Air" }
// { name: "Power Supply Maximum Wattage", value: "600 watts" }
// { name: "Enclosure Type",           value: "Mid tower" }
// { name: "Product Name",             value: "Slate MESH Gaming Desktop PC..." }
type BestBuyDetail = { name: string; value: string }

/** Look up a spec by partial name match (case-insensitive) */
function getDetail(details: BestBuyDetail[], ...keys: string[]): string | null {
  for (const key of keys) {
    const found = details.find(d => d.name.toLowerCase().includes(key.toLowerCase()))
    if (found?.value) return found.value.trim()
  }
  return null
}

/**
 * Extract the chipset code from a "Motherboard Model Number" value.
 * "B760 D5" → "B760", "Z790-A" → "Z790", "X670E" → "X670E"
 */
function extractChipsetCode(moboModelNum: string): string {
  const m = moboModelNum.match(/\b([BZHXA]\d{3}[A-Z]*)\b/i)
  return m ? m[1].toUpperCase() : moboModelNum.split(/\s/)[0]
}

/**
 * Parse PSU wattage from strings like "600 watts", "750W", "850 Watts".
 * Returns "600W power supply" etc.
 */
function parsePsuWattage(wattageStr: string): string | null {
  const m = wattageStr.match(/(\d+)\s*(?:watt|w\b)/i)
  return m ? `${m[1]}W power supply` : null
}

/**
 * Extract the product series/model name for case search.
 * Strips brand name + hardware specs, leaving just the product line name.
 * "iBUYPOWER - Slate MESH Gaming Desktop PC -Intel Core i7..."  → "Slate MESH"
 * "CyberPowerPC Gamer Xtreme VR Gaming PC"                      → "Gamer Xtreme VR"
 */
function extractCaseSeries(productName: string, brandName: string): string | null {
  const escaped = brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Strip brand name
  let stripped = productName.replace(new RegExp(escaped, 'i'), '').trim()
  // Remove leading dashes / separators like " - "
  stripped = stripped.replace(/^[\s\-–—]+/, '').trim()
  // Cut off at the first hardware spec separator or "Gaming Desktop/PC" phrase
  const cutoff = stripped.search(
    /\s*[-–—]\s*(?:Intel|AMD|NVIDIA|Ryzen|Core)\b|\bGaming\s+(?:Desktop|PC|Tower)\b|\bDesktop\s+PC\b/i
  )
  if (cutoff > 0) stripped = stripped.slice(0, cutoff).trim()

  // Now stripped should be something like "Slate MESH" or "Gamer Xtreme"
  const tokens = stripped.split(/\s+/).filter(t => t.length >= 2 && /[a-zA-Z]/.test(t))
  const series = tokens.slice(0, 3).join(' ')
  return series.length >= 2 ? series : null
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

  // ── Extract from spec details (confirmed real field names from live API) ──
  const details = (product.details as BestBuyDetail[] | undefined) ?? []

  // "Motherboard Model Number" = "B760 D5" → chipset "B760"
  const moboModelNum = getDetail(details, 'motherboard model number')
  const chipset = moboModelNum ? extractChipsetCode(moboModelNum) : null

  // "CPU Cooling System" = "Air" | "Liquid"
  const coolerType = getDetail(details, 'cpu cooling system', 'cooling system', 'cooler type')

  // "Power Supply Maximum Wattage" = "600 watts"
  const psuWattageRaw = getDetail(details, 'power supply maximum wattage', 'power supply wattage')
  const psuName = psuWattageRaw ? parsePsuWattage(psuWattageRaw) : null

  // "Enclosure Type" = "Mid tower" / "Full tower" / "Mini tower"
  const enclosureType = getDetail(details, 'enclosure type')

  // "Product Name" detail — cleaner than the full listing name for case series extraction
  const productNameDetail = getDetail(details, 'product name') ?? prebuiltName

  const parts: ExtractedPart[] = []
  const seen = new Set<ExtractedPart['type']>()

  // ── Feature list: CPU, GPU, memory, storage ──────────────────────────────
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

  // ── Motherboard: from "Motherboard Model Number" detail ──────────────────
  if (!seen.has('motherboard') && chipset) {
    const moboName = resolveMotherboardFromChipset(chipset)
    if (moboName) {
      parts.push({ type: 'motherboard', name: moboName })
      seen.add('motherboard')
    }
  }

  // ── Cooling: from "CPU Cooling System" detail ────────────────────────────
  if (!seen.has('cooling') && coolerType) {
    const coolerName = resolveCoolerName(coolerType, parts)
    if (coolerName) {
      parts.push({ type: 'cooling', name: coolerName })
      seen.add('cooling')
    }
  }

  // ── PSU: from "Power Supply Maximum Wattage" detail ─────────────────────
  if (!seen.has('psu') && psuName) {
    parts.push({ type: 'psu', name: psuName })
    seen.add('psu')
  }

  // ── Case: series name from product title + enclosure type ────────────────
  if (!seen.has('case')) {
    const series = manufacturer ? extractCaseSeries(productNameDetail, manufacturer) : null
    if (series && enclosureType) {
      // e.g. "iBUYPOWER Slate MESH mid tower case"
      const enclosure = enclosureType.toLowerCase().includes('tower') ? enclosureType.toLowerCase() : 'mid tower'
      parts.push({ type: 'case', name: `${manufacturer} ${series} ${enclosure} case`, suggested: true })
      seen.add('case')
    } else if (series && manufacturer) {
      parts.push({ type: 'case', name: `${manufacturer} ${series} case`, suggested: true })
      seen.add('case')
    } else if (enclosureType) {
      // At least we know the form factor
      parts.push({ type: 'case', name: `${enclosureType} PC case`, suggested: true })
      seen.add('case')
    }
  }

  // ── Fallback suggestions for anything still missing ──────────────────────
  const suggestions = suggestMissingParts(parts)
  parts.push(...suggestions)

  return { prebuiltName, prebuiltPrice, prebuiltImageUrl, retailer: 'bestbuy', parts }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveMotherboardFromChipset(chipset: string): string | null {
  const c = chipset.toUpperCase().trim()

  // Intel LGA1700 (12th/13th/14th gen): Z690/Z790/H670/H770/B660/B760
  if (/^Z[679]\d0/.test(c)) return `Intel ${c} ATX motherboard LGA1700`
  if (/^H[67]\d0/.test(c)) return `Intel ${c} ATX motherboard LGA1700`
  if (/^B[67]\d0/.test(c)) return `Intel ${c} ATX motherboard LGA1700`

  // Intel LGA1851 (Arrow Lake 15th gen): Z890/B860/H810
  if (/^Z8[59]0/.test(c)) return `Intel ${c} ATX motherboard LGA1851`
  if (/^B8[56]0/.test(c)) return `Intel ${c} ATX motherboard LGA1851`
  if (/^H8[12]0/.test(c)) return `Intel ${c} ATX motherboard LGA1851`

  // AMD AM5 (Ryzen 7000/9000): X670/X870/B650/B850
  if (/^X[68]\d0/.test(c)) return `AMD ${c} ATX motherboard AM5`
  if (/^B[68]\d0/.test(c)) return `AMD ${c} ATX motherboard AM5`
  if (/^A[68]\d0/.test(c)) return `AMD ${c} ATX motherboard AM5`

  // AMD AM4 (Ryzen 5000 and older): X570/X470/B550/B450
  if (/^X[45]\d0/.test(c)) return `AMD ${c} ATX motherboard AM4`
  if (/^B[45]\d0/.test(c)) return `AMD ${c} ATX motherboard AM4`
  if (/^A[45]\d0/.test(c)) return `AMD ${c} ATX motherboard AM4`

  // Unknown chipset — generic fallback
  return `${chipset} motherboard`
}

function resolveCoolerName(coolerType: string, parts: ExtractedPart[]): string | null {
  const t = coolerType.toLowerCase()
  const cpuName = parts.find(p => p.type === 'cpu')?.name ?? ''

  if (/liquid|aio|water/i.test(t)) {
    if (/i9|ryzen\s*9/i.test(cpuName)) return '360mm AIO liquid cooler'
    if (/i7|ryzen\s*7/i.test(cpuName)) return '240mm AIO liquid cooler'
    return '240mm AIO liquid cooler'
  }

  if (/air|tower|fan/i.test(t)) {
    return 'CPU air cooler'
  }

  return null
}
