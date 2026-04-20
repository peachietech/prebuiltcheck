import { parse } from 'node-html-parser'
import type { ParsedListing } from './index'
import type { ExtractedPart } from '@/types'

const PART_PATTERNS: { type: ExtractedPart['type']; patterns: RegExp[] }[] = [
  { type: 'cpu', patterns: [/intel core/i, /amd ryzen/i, /processor/i] },
  { type: 'gpu', patterns: [/nvidia geforce/i, /rtx \d+/i, /amd radeon/i, /rx \d+/i, /\bgpu\b/i] },
  { type: 'memory', patterns: [/\bddr[45]\b/i, /\bram\b/i, /gb.*memory/i] },
  { type: 'storage', patterns: [/\bnvme\b/i, /\bssd\b/i, /\bhdd\b/i, /tb.*storage/i, /gb.*storage/i] },
  { type: 'motherboard', patterns: [/motherboard/i, /\bmobo\b/i] },
  { type: 'psu', patterns: [/power supply/i, /\bpsu\b/i, /\d+w\b/i] },
  { type: 'case', patterns: [/\bcase\b/i, /mid tower/i, /full tower/i, /atx.*chassis/i] },
  { type: 'cooling', patterns: [/cooler/i, /\baio\b/i, /liquid cool/i, /\bfan\b/i] },
]

function classifyLine(text: string): ExtractedPart['type'] | null {
  for (const { type, patterns } of PART_PATTERNS) {
    if (patterns.some(p => p.test(text))) return type
  }
  return null
}

export function parseBestBuy(html: string, url: string): ParsedListing {
  const root = parse(html)

  const prebuiltName = root.querySelector('.sku-title')?.text.trim() ??
    root.querySelector('h1')?.text.trim() ?? 'Unknown Product'

  const priceText = root.querySelector('.priceView-customer-price span')?.text ?? ''
  const prebuiltPrice = parseFloat(priceText.replace(/[^0-9.]/g, '')) || null

  const prebuiltImageUrl = root.querySelector('.primary-image')?.getAttribute('src') ?? null

  const parts: ExtractedPart[] = []
  const seen = new Set<ExtractedPart['type']>()

  const featureItems = root.querySelectorAll('.feature-list li, .features-list li, ul.bullets li')
  for (const item of featureItems) {
    const text = item.text.trim()
    const type = classifyLine(text)
    if (type && !seen.has(type)) {
      parts.push({ type, name: text })
      seen.add(type)
    }
  }

  return { prebuiltName, prebuiltPrice, prebuiltImageUrl, retailer: 'bestbuy', parts }
}
