import { parse } from 'node-html-parser'
import type { ParsedListing } from './index'
import type { ExtractedPart } from '@/types'
import {
  extractJsonLd, extractTitle, extractImage, extractPrice,
  extractPartsFromText, gatherSpecLines,
} from './generic'
import { suggestMissingParts } from '@/lib/scraping/partUtils'

export function parseNewegg(html: string, url: string): ParsedListing {
  const root = parse(html)
  const jsonLd = extractJsonLd(html)

  const prebuiltName = extractTitle(root)
  const prebuiltPrice = extractPrice(root, jsonLd)
  const prebuiltImageUrl = extractImage(root)

  const specLines: string[] = []

  // ── Strategy 1: JSON-LD description (most reliable on Newegg product pages) ──
  if (jsonLd?.description && typeof jsonLd.description === 'string') {
    jsonLd.description.split(/[\n,•·|]/).forEach(s => specLines.push(s.trim()))
  }

  // ── Strategy 2: Newegg spec table (current and legacy selectors) ──────────
  const tableSelectors = [
    '.product-specs tr',        // classic product page
    '.specifications tr',       // alternate layout
    '.tab-pane table tr',       // tabbed spec section
    '[class*="Specification"] tr',
    '[class*="spec"] tr',
    'table tr',                 // any table on the page
  ]
  for (const sel of tableSelectors) {
    root.querySelectorAll(sel).forEach(row => {
      const text = row.text.replace(/\s+/g, ' ').trim()
      if (text) specLines.push(text)
    })
  }

  // ── Strategy 3: Bullet lists in description / features area ──────────────
  const bulletSelectors = [
    '.product-bullets li',
    '.product-desc li',
    '[class*="feature"] li',
    '[class*="desc"] li',
    'ul li',
  ]
  for (const sel of bulletSelectors) {
    root.querySelectorAll(sel).forEach(li => {
      const text = li.text.trim()
      if (text.length > 4) specLines.push(text)
    })
  }

  // ── Strategy 4: Generic catch-all (all spec-like containers) ─────────────
  gatherSpecLines(root).forEach(l => specLines.push(l))

  const parts: ExtractedPart[] = extractPartsFromText([...new Set(specLines)])

  const suggestions = suggestMissingParts(parts)
  return {
    prebuiltName: prebuiltName || 'Unknown Product',
    prebuiltPrice,
    prebuiltImageUrl,
    retailer: 'newegg',
    parts: [...parts, ...suggestions],
  }
}
