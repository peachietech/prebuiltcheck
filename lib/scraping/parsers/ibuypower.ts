import { parse } from 'node-html-parser'
import type { ParsedListing } from './index'
import type { ExtractedPart } from '@/types'
import { extractJsonLd, extractTitle, extractImage, extractPrice, extractPartsFromText } from './generic'
import { suggestMissingParts } from '@/lib/scraping/partUtils'

/**
 * iBUYPOWER parser.
 * Their RDY store pages embed product data in JSON-LD + a Next.js __NEXT_DATA__ blob.
 * We try __NEXT_DATA__ first (richest), then JSON-LD, then spec table.
 */
export function parseiBUYPOWER(html: string, url: string): ParsedListing {
  const root = parse(html)

  let parts: ExtractedPart[] = []
  let prebuiltName = ''
  let prebuiltPrice: number | null = null
  let prebuiltImageUrl: string | null = null

  // Try extracting from Next.js page data (iBUYPOWER uses Next.js)
  const nextDataScript = root.querySelector('#__NEXT_DATA__')

  if (nextDataScript) {
    try {
      const nextData: unknown = JSON.parse(nextDataScript.rawText)
      const product = findProductInNextData(nextData)
      if (product) {
        prebuiltName = String(product.name ?? product.title ?? '')
        prebuiltPrice = parseFloat(String(product.price ?? product.salePrice ?? product.regularPrice ?? '')) || null
        const imgArr = Array.isArray(product.images) ? (product.images as unknown[]) : []
        const firstImg = imgArr[0]
        prebuiltImageUrl = String(product.imageUrl ?? product.image ??
          (firstImg && typeof firstImg === 'object' && 'url' in firstImg ? (firstImg as { url: string }).url : '') ?? '')
          || null

        // Build spec lines from product properties
        const specLines: string[] = []
        const pushStr = (v: unknown) => { if (typeof v === 'string' && v) specLines.push(v) }

        pushStr(product.cpu ?? product.processor)
        pushStr(product.gpu ?? product.graphics)
        pushStr(product.memory ?? product.ram)
        pushStr(product.storage)
        pushStr(product.motherboard)
        pushStr(product.psu ?? product.powerSupply)
        pushStr(product.case ?? product.chassis)
        pushStr(product.cooling ?? product.cooler)

        // Also try specs array
        const specs = Array.isArray(product.specs) ? product.specs :
          Array.isArray(product.specifications) ? product.specifications : []
        for (const spec of specs) {
          if (typeof spec === 'string') specLines.push(spec)
          else if (spec && typeof spec === 'object') {
            const s = spec as Record<string, unknown>
            if (s.name && s.value) specLines.push(`${s.name}: ${s.value}`)
          }
        }

        parts = extractPartsFromText(specLines)
      }
    } catch {
      // fall through
    }
  }

  // Fall back to JSON-LD + spec table
  if (!prebuiltName || parts.length < 2) {
    const jsonLd = extractJsonLd(html)
    prebuiltName = prebuiltName || extractTitle(root)
    prebuiltPrice = prebuiltPrice ?? extractPrice(root, jsonLd)
    prebuiltImageUrl = prebuiltImageUrl ?? extractImage(root)

    // Research finding: iBUYPOWER embeds specs in JSON-LD `description` as plain text
    // e.g. "AMD Ryzen™ 7 9800X3D Processor (8X 4.7GHz/96MB L3 Cache)\nGeForce RTX 5070..."
    const specLines: string[] = []
    if (jsonLd?.description && typeof jsonLd.description === 'string') {
      jsonLd.description.split(/[\n,•·|]/).forEach(s => specLines.push(s.trim()))
    }

    // iBUYPOWER spec table: look for rows with colon-separated label: value
    const rows = root.querySelectorAll('.specs-table tr, .spec-table tr, table tr, [class*="specs"] tr')
    rows.forEach(row => specLines.push(row.text.replace(/\s+/g, ' ').trim()))

    // Also grab bullet lists in the description
    root.querySelectorAll('.product-description li, .description li, [class*="features"] li')
      .forEach(b => specLines.push(b.text.trim()))

    if (parts.length < 2) parts = extractPartsFromText(specLines)
  }

  const suggestions = suggestMissingParts(parts)
  return {
    prebuiltName: prebuiltName || 'Unknown Product',
    prebuiltPrice,
    prebuiltImageUrl,
    retailer: 'ibuypower',
    parts: [...parts, ...suggestions],
  }
}

// Recursively hunt for a product-like object in Next.js pageProps
function findProductInNextData(data: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 8 || !data || typeof data !== 'object' || Array.isArray(data)) return null
  const obj = data as Record<string, unknown>

  // Check if this object looks like a product
  if ((obj.name || obj.title) && (obj.price || obj.specs || obj.cpu || obj.gpu)) {
    return obj
  }

  for (const val of Object.values(obj)) {
    const found = findProductInNextData(val, depth + 1)
    if (found) return found
  }
  return null
}
