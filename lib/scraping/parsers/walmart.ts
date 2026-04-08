import { parse } from 'node-html-parser'
import type { ParsedListing } from './index'
import type { ExtractedPart } from '@/types'

const SPEC_LABEL_MAP: Record<string, ExtractedPart['type']> = {
  'processor': 'cpu', 'cpu': 'cpu',
  'graphics': 'gpu', 'gpu': 'gpu', 'video card': 'gpu',
  'ram': 'memory', 'memory': 'memory',
  'storage': 'storage', 'hard drive': 'storage', 'ssd': 'storage',
  'motherboard': 'motherboard',
  'power': 'psu',
  'case': 'case',
  'cooling': 'cooling',
}

export function parseWalmart(html: string, url: string): ParsedListing {
  const root = parse(html)

  const prebuiltName = root.querySelector('[itemprop="name"]')?.text.trim() ??
    root.querySelector('h1')?.text.trim() ?? 'Unknown Product'

  const priceText = root.querySelector('[itemprop="price"]')?.getAttribute('content') ??
    root.querySelector('.price-characteristic')?.text ?? ''
  const prebuiltPrice = parseFloat(priceText.replace(/[^0-9.]/g, '')) || null

  const prebuiltImageUrl = root.querySelector('[data-testid="hero-image"] img')?.getAttribute('src') ?? null

  const parts: ExtractedPart[] = []
  const seen = new Set<ExtractedPart['type']>()

  const specRows = root.querySelectorAll('[data-testid="specification-row"]')
  for (const row of specRows) {
    const children = row.querySelectorAll('span, div')
    if (children.length < 2) continue
    const label = children[0].text.trim().toLowerCase()
    const value = children[1].text.trim()
    for (const [key, type] of Object.entries(SPEC_LABEL_MAP)) {
      if (label.includes(key) && !seen.has(type) && value) {
        parts.push({ type, name: value })
        seen.add(type)
        break
      }
    }
  }

  return { prebuiltName, prebuiltPrice, prebuiltImageUrl, retailer: 'walmart', parts }
}
