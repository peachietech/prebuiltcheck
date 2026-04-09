import { parse } from 'node-html-parser'
import type { ParsedListing } from './index'
import { extractPartsFromText } from './generic'
import { suggestMissingParts } from '@/lib/scraping/partUtils'

/**
 * NZXT BLD parser.
 * NZXT uses Shopify — their product JSON is available at /products/{handle}.json
 * but since we receive rendered HTML from ScrapingBee, we parse the Shopify
 * embedded JSON from window.ShopifyAnalytics.meta or product JSON-LD.
 */
export function parseNZXT(html: string, url: string): ParsedListing {
  const root = parse(html)

  let prebuiltName = 'Unknown Product'
  let prebuiltPrice: number | null = null
  let prebuiltImageUrl: string | null = null
  let specLines: string[] = []

  // NZXT embeds Shopify product data in a script tag
  const scripts = root.querySelectorAll('script:not([src])')
  for (const script of scripts) {
    const text = script.rawText

    // Shopify product JSON
    if (text.includes('"product_type"') || text.includes('"variants"')) {
      const match = text.match(/(\{[^{}]*"variants"[^{}]*\{[\s\S]*?\}\s*\})/) ??
        text.match(/var\s+meta\s*=\s*(\{[\s\S]*?\});/)
      if (match) {
        try {
          const data = JSON.parse(match[1])
          const product = data.product ?? data
          prebuiltName = product.title ?? prebuiltName
          prebuiltPrice = parseFloat(String(product.variants?.[0]?.price)) / 100 || null
          prebuiltImageUrl = product.featured_image ?? product.images?.[0]?.src ?? null

          // Shopify product body_html contains the spec list as HTML
          if (product.body_html) {
            const bodyRoot = parse(product.body_html)
            bodyRoot.querySelectorAll('li, td, p').forEach(el => {
              specLines.push(el.text.trim())
            })
          }
        } catch {
          // continue
        }
        break
      }
    }

    // NZXT BLD pages also have a window.NZXT_DATA or similar
    if (text.includes('NZXT') && text.includes('"specs"')) {
      const match = text.match(/"specs"\s*:\s*(\[[\s\S]*?\])/)
      if (match) {
        try {
          const specs = JSON.parse(match[1]) as string[]
          specLines.push(...specs)
        } catch {
          // ignore
        }
      }
    }
  }

  // Fallback to HTML
  if (!prebuiltName || prebuiltName === 'Unknown Product') {
    prebuiltName = root.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() ??
      root.querySelector('h1')?.text.trim() ?? 'Unknown Product'
  }
  if (!prebuiltImageUrl) {
    prebuiltImageUrl = root.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? null
  }

  // NZXT BLD spec rows
  root.querySelectorAll(
    '.product-specs li, .specs-list li, [class*="spec"] li, .pdp-specs tr, .product__description li'
  ).forEach(el => specLines.push(el.text.trim()))

  const parts = extractPartsFromText(specLines)
  const suggestions = suggestMissingParts(parts)

  return {
    prebuiltName,
    prebuiltPrice,
    prebuiltImageUrl,
    retailer: 'nzxt',
    parts: [...parts, ...suggestions],
  }
}
