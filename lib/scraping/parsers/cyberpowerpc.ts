import { parse } from 'node-html-parser'
import type { ParsedListing } from './index'
import { extractJsonLd, extractTitle, extractImage, extractPrice, extractPartsFromText, gatherSpecLines } from './generic'
import { suggestMissingParts } from '@/lib/scraping/partUtils'

/**
 * CyberPowerPC parser.
 * System pages list components in a spec table under .sys_list or similar.
 * Example URL: cyberpowerpc.com/system/Prebuilt-PC-GML-99749
 */
export function parseCyberPowerPC(html: string, url: string): ParsedListing {
  const root = parse(html)
  const jsonLd = extractJsonLd(html)

  const prebuiltName = extractTitle(root)
  const prebuiltPrice = extractPrice(root, jsonLd)
  const prebuiltImageUrl = extractImage(root)

  // CyberPowerPC uses a spec list — each row has a label (e.g. "Processor") and value
  const specLines: string[] = []

  // Main spec table rows
  const rows = root.querySelectorAll(
    '.sys_list tr, .spec_table tr, .system-specs tr, .product-specs tr, table tr'
  )
  for (const row of rows) {
    const cells = row.querySelectorAll('td, th')
    if (cells.length >= 2) {
      // "Processor | Intel Core i7-14700F ..."
      specLines.push(cells.map(c => c.text.trim()).join(': '))
    } else {
      specLines.push(row.text.trim())
    }
  }

  // Feature bullets
  root.querySelectorAll('.sys_desc li, .description li, ul.bullets li').forEach(el => {
    specLines.push(el.text.trim())
  })

  // Fallback: generic spec gathering
  if (specLines.length < 4) specLines.push(...gatherSpecLines(root))

  const parts = extractPartsFromText(specLines)
  const suggestions = suggestMissingParts(parts)

  return {
    prebuiltName,
    prebuiltPrice,
    prebuiltImageUrl,
    retailer: 'cyberpowerpc',
    parts: [...parts, ...suggestions],
  }
}
