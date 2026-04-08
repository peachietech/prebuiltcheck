import { parse } from 'node-html-parser'
import type { ParsedListing } from './index'
import type { ExtractedPart } from '@/types'

const SPEC_LABEL_MAP: Record<string, ExtractedPart['type']> = {
  'cpu': 'cpu', 'processor': 'cpu',
  'gpu': 'gpu', 'graphics': 'gpu', 'video card': 'gpu',
  'memory': 'memory', 'ram': 'memory',
  'storage': 'storage', 'hard drive': 'storage', 'ssd': 'storage',
  'motherboard': 'motherboard',
  'power supply': 'psu', 'psu': 'psu',
  'case': 'case', 'chassis': 'case',
  'cooling': 'cooling', 'cooler': 'cooling',
}

export function parseNewegg(html: string, url: string): ParsedListing {
  const root = parse(html)

  const prebuiltName = root.querySelector('.product-title')?.text.trim() ??
    root.querySelector('h1')?.text.trim() ?? 'Unknown Product'

  const priceText = root.querySelector('.price-current')?.text ?? ''
  const prebuiltPrice = parseFloat(priceText.replace(/[^0-9.]/g, '')) || null

  const prebuiltImageUrl = root.querySelector('.product-view-img-original')?.getAttribute('src') ?? null

  const parts: ExtractedPart[] = []
  const seen = new Set<ExtractedPart['type']>()

  const rows = root.querySelectorAll('.product-specs tr, .specifications tr')
  for (const row of rows) {
    const label = row.querySelector('th')?.text.trim().toLowerCase() ?? ''
    const value = row.querySelector('td')?.text.trim() ?? ''
    if (!value) continue

    for (const [key, type] of Object.entries(SPEC_LABEL_MAP)) {
      if (label.includes(key) && !seen.has(type)) {
        parts.push({ type, name: value })
        seen.add(type)
        break
      }
    }
  }

  return { prebuiltName, prebuiltPrice, prebuiltImageUrl, retailer: 'newegg', parts }
}
