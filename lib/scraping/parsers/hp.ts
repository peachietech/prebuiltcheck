import { parse } from 'node-html-parser'
import type { ParsedListing } from './index'
import { extractJsonLd, extractTitle, extractImage, extractPrice, extractPartsFromText } from './generic'
import { suggestMissingParts } from '@/lib/scraping/partUtils'

/**
 * HP parser.
 * HP product pages embed structured data in JSON-LD and spec tables.
 * Product IDs follow the pattern: /pdp/{name}-{sku}-1
 */
export function parseHP(html: string, url: string): ParsedListing {
  const root = parse(html)
  const jsonLd = extractJsonLd(html)

  const prebuiltName = extractTitle(root)
  const prebuiltPrice = extractPrice(root, jsonLd)
  const prebuiltImageUrl = extractImage(root)

  const specLines: string[] = []

  // HP spec rows — HP uses a definition list or table for specs
  root.querySelectorAll(
    '.pdp-overview-specs dt, .pdp-overview-specs dd, ' +
    '.spec-table td, .spec-table th, ' +
    '[data-automation-id="spec"] td, [data-automation-id="spec"] th, ' +
    '.product-specs-item, .hp-specs-item'
  ).forEach(el => specLines.push(el.text.trim()))

  // HP feature bullets
  root.querySelectorAll(
    '.feature-item, .pdp-features li, [class*="feature"] li, .overview-features li'
  ).forEach(el => specLines.push(el.text.trim()))

  // HP sometimes embeds product data in an Apollo/Redux store
  const scripts = root.querySelectorAll('script:not([src])')
  for (const script of scripts) {
    const text = script.rawText
    if (text.includes('"specifications"') && text.includes('"value"')) {
      // Try to extract spec objects like [{name: "Processor", value: "Intel Core i9"}]
      const match = text.match(/"specifications"\s*:\s*(\[[\s\S]*?\])/)
      if (match) {
        try {
          const specs = JSON.parse(match[1]) as Array<{ name?: string; value?: string; label?: string }>
          specs.forEach(s => {
            const label = s.name ?? s.label ?? ''
            const val = s.value ?? ''
            if (val) specLines.push(`${label}: ${val}`)
          })
        } catch {
          // ignore
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
    retailer: 'hp',
    parts: [...parts, ...suggestions],
  }
}
