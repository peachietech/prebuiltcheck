/**
 * NZXT uses Shopify — every product page has a free JSON endpoint:
 * https://nzxt.com/products/{handle}.json
 *
 * No API key needed. No scraping credits consumed.
 * Parse specs from body_html and variant options.
 */
import type { ParsedListing } from './parsers/index'
import type { ExtractedPart } from '@/types'
import { parse } from 'node-html-parser'
import { extractPartsFromText } from './parsers/generic'
import { suggestMissingParts } from './partUtils'

interface ShopifyVariant {
  price: string
  sku?: string
  option1?: string
  option2?: string
  option3?: string
}

interface ShopifyImage {
  src: string
}

interface ShopifyProduct {
  title: string
  body_html: string
  images: ShopifyImage[]
  variants: ShopifyVariant[]
}

function handleFromUrl(url: string): string {
  // https://nzxt.com/products/player-one-black → player-one-black
  const match = url.match(/\/products\/([^/?#]+)/)
  return match ? match[1] : ''
}

export async function fetchNZXTProduct(url: string): Promise<ParsedListing> {
  const handle = handleFromUrl(url)
  if (!handle) throw new Error('Could not extract NZXT product handle from URL')

  const apiUrl = `https://nzxt.com/products/${handle}.json`
  const res = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; PrebuiltCheck/1.0)',
      Accept: 'application/json',
    },
  })

  if (!res.ok) throw new Error(`NZXT API error: ${res.status}`)
  const data = await res.json() as { product: ShopifyProduct }
  const product = data.product

  if (!product) throw new Error('NZXT product not found')

  const prebuiltName = product.title
  // Shopify stores prices in dollars (not cents) as a string like "999.00"
  const prebuiltPrice = parseFloat(product.variants?.[0]?.price ?? '0') || null
  const prebuiltImageUrl = product.images?.[0]?.src ?? null

  // Parse specs from body_html — Shopify stores the rich description as HTML
  const bodyRoot = parse(product.body_html ?? '')
  const specLines: string[] = []

  // List items and table cells from description
  bodyRoot.querySelectorAll('li, td, th, p').forEach(el => {
    specLines.push(el.text.trim())
  })

  // Also check variant option labels (e.g. "Intel Core i5-14400F | RTX 4060")
  for (const variant of product.variants ?? []) {
    for (const opt of [variant.option1, variant.option2, variant.option3]) {
      if (opt && opt.length > 3) specLines.push(opt)
    }
  }

  // If body_html was empty/minimal, fall back to plain text split
  if (specLines.length < 3) {
    const plainText = bodyRoot.text ?? ''
    plainText.split(/[,\n|•·]/).forEach(s => specLines.push(s.trim()))
  }

  const parts: ExtractedPart[] = extractPartsFromText(specLines)

  // Try to extract NZXT case from product title (e.g. "Player One — Black" → NZXT H3 Flow)
  // The research showed NZXT BLD uses their own cases, often H-series
  if (!parts.find(p => p.type === 'case')) {
    const caseMatch = prebuiltName.match(/\bH\d+\s*(?:Flow|Elite|i|RGB)?\b/i)
    if (caseMatch) {
      parts.push({ type: 'case', name: `NZXT ${caseMatch[0].trim()} case` })
    }
  }

  const suggestions = suggestMissingParts(parts)
  return {
    prebuiltName,
    prebuiltPrice,
    prebuiltImageUrl,
    retailer: 'nzxt',
    parts: [...parts, ...suggestions],
  }
}
