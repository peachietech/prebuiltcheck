/**
 * Generic HTML parsing utilities shared across retailer parsers.
 * Relies on standard e-commerce signals: JSON-LD Product schema,
 * Open Graph tags, and spec table patterns.
 */
import { parse, HTMLElement } from 'node-html-parser'
import type { ExtractedPart } from '@/types'
import { cleanPartName } from '@/lib/scraping/partUtils'

const PART_PATTERNS: { type: ExtractedPart['type']; patterns: RegExp[] }[] = [
  { type: 'cpu', patterns: [/intel core/i, /amd ryzen/i, /\bprocessor\b/i, /\bcpu\b/i] },
  { type: 'gpu', patterns: [/nvidia geforce/i, /rtx \d+/i, /gtx \d+/i, /amd radeon/i, /rx \d+/i, /\bgpu\b/i, /graphics card/i] },
  { type: 'memory', patterns: [/\bddr[45]\b/i, /\bram\b/i, /gb.*memory/i, /memory.*gb/i] },
  { type: 'storage', patterns: [/\bnvme\b/i, /\bssd\b/i, /\bhdd\b/i, /\bm\.2\b/i, /tb.*storage/i, /gb.*storage/i, /solid.?state/i] },
  { type: 'motherboard', patterns: [/motherboard/i, /\bmobo\b/i, /\bchipset\b/i, /\bz[67]\d0\b/i, /\bb[567]\d0\b/i] },
  { type: 'psu', patterns: [/power supply/i, /\bpsu\b/i, /\d+\s*w(?:att)?\b.*power/i, /power.*\d+\s*w/i] },
  { type: 'case', patterns: [/\bcase\b/i, /mid.?tower/i, /full.?tower/i, /mini.?itx/i, /atx.*chassis/i, /\bchassis\b/i] },
  { type: 'cooling', patterns: [/\bcooler\b/i, /\baio\b/i, /liquid cool/i, /cpu fan/i, /heat.?sink/i, /cooling system/i] },
]

export function classifyText(text: string): ExtractedPart['type'] | null {
  for (const { type, patterns } of PART_PATTERNS) {
    if (patterns.some(p => p.test(text))) return type
  }
  return null
}

/** Extract structured product data from JSON-LD script tags */
export function extractJsonLd(html: string): Record<string, unknown> | null {
  const root = parse(html)
  const scripts = root.querySelectorAll('script[type="application/ld+json"]')

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.rawText)
      // Handle both single object and @graph array
      const items: unknown[] = Array.isArray(data['@graph']) ? data['@graph'] : [data]
      for (const item of items) {
        if (
          item &&
          typeof item === 'object' &&
          ('@type' in item) &&
          (item as Record<string, unknown>)['@type'] === 'Product'
        ) {
          return item as Record<string, unknown>
        }
      }
    } catch {
      // ignore malformed JSON
    }
  }
  return null
}

/** Get page title from OG tag or <title> */
export function extractTitle(root: HTMLElement, fallback = 'Unknown Product'): string {
  return (
    root.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() ??
    root.querySelector('h1')?.text.trim() ??
    root.querySelector('title')?.text.trim() ??
    fallback
  )
}

/** Get product image from OG tag or first img with "product" in src */
export function extractImage(root: HTMLElement): string | null {
  return (
    root.querySelector('meta[property="og:image"]')?.getAttribute('content') ??
    root.querySelector('img[src*="product"]')?.getAttribute('src') ??
    null
  )
}

/** Extract price from common patterns */
export function extractPrice(root: HTMLElement, jsonLd: Record<string, unknown> | null): number | null {
  // JSON-LD offer price
  if (jsonLd) {
    const offers = jsonLd['offers'] as Record<string, unknown> | Array<Record<string, unknown>> | undefined
    const offer = Array.isArray(offers) ? offers[0] : offers
    if (offer?.['price']) return parseFloat(String(offer['price']))
  }

  // Common price selectors
  const priceSelectors = [
    '[data-price]', '[itemprop="price"]', '.price', '.product-price',
    '[class*="price"]', '[id*="price"]',
  ]
  for (const sel of priceSelectors) {
    const el = root.querySelector(sel)
    const text = el?.getAttribute('content') ?? el?.text ?? ''
    const price = parseFloat(text.replace(/[^0-9.]/g, ''))
    if (price > 0) return price
  }
  return null
}

/** Extract parts from any text-based spec list */
export function extractPartsFromText(lines: string[]): ExtractedPart[] {
  const parts: ExtractedPart[] = []
  const seen = new Set<ExtractedPart['type']>()

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.length < 4) continue
    const type = classifyText(trimmed)
    if (type && !seen.has(type)) {
      parts.push({ type, name: cleanPartName(trimmed, type) })
      seen.add(type)
    }
  }
  return parts
}

/** Pull all text lines from common spec containers */
export function gatherSpecLines(root: HTMLElement): string[] {
  const containers = [
    // Table rows — spec tables
    ...root.querySelectorAll('table tr td, table tr th'),
    // Definition lists
    ...root.querySelectorAll('dl dt, dl dd'),
    // Bullet lists
    ...root.querySelectorAll('ul li, ol li'),
    // Any element with "spec" in class/id
    ...root.querySelectorAll('[class*="spec"], [id*="spec"], [class*="feature"], [id*="feature"]'),
  ]

  return [...new Set(containers.map(el => el.text.trim()).filter(t => t.length > 3))]
}
