import { parse } from 'node-html-parser'
import type { ParsedListing } from './index'
import { extractJsonLd, extractTitle, extractImage, extractPrice, extractPartsFromText } from './generic'
import { suggestMissingParts } from '@/lib/scraping/partUtils'

/**
 * Costco parser.
 * Product pages include JSON-LD and a "Features & Benefits" bullet list.
 * Costco embeds product data in window.__INITIAL_STATE__ as well.
 */
export function parseCostco(html: string, url: string): ParsedListing {
  const root = parse(html)
  const jsonLd = extractJsonLd(html)

  const prebuiltName = extractTitle(root)
  const prebuiltPrice = extractPrice(root, jsonLd)
  const prebuiltImageUrl = extractImage(root)

  const specLines: string[] = []

  // Costco feature bullets are in .features-list or .product-info-description
  const featureLists = root.querySelectorAll(
    '.features-list li, .product-info-description li, .pdp-features li, [class*="feature"] li'
  )
  featureLists.forEach(el => specLines.push(el.text.trim()))

  // Spec table
  root.querySelectorAll('.product-specs-table tr, .spec-table tr, table tr').forEach(row => {
    specLines.push(row.text.replace(/\s+/g, ' ').trim())
  })

  // Try window.__INITIAL_STATE__ (Costco SPA data)
  const scripts = root.querySelectorAll('script:not([src])')
  for (const script of scripts) {
    const content = script.rawText
    if (content.includes('__INITIAL_STATE__')) {
      const match = content.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?\s*(?:window|$)/)
      if (match) {
        try {
          const state = JSON.parse(match[1])
          const product = state?.product?.item ?? state?.pdp?.product
          if (product?.features) {
            const features: unknown[] = Array.isArray(product.features) ? product.features : []
            features.forEach((f: unknown) => {
              if (typeof f === 'string') specLines.push(f)
              else if (f && typeof f === 'object' && 'feature' in f) specLines.push((f as { feature: string }).feature)
            })
          }
        } catch {
          // ignore parse errors
        }
      }
      break
    }
  }

  const parts = extractPartsFromText(specLines)
  const suggestions = suggestMissingParts(parts)

  return {
    prebuiltName,
    prebuiltPrice,
    prebuiltImageUrl,
    retailer: 'costco',
    parts: [...parts, ...suggestions],
  }
}
