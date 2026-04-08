import { parse } from 'node-html-parser'
import type { ParsedListing } from './index'
import type { ExtractedPart } from '@/types'

const SPEC_LABEL_MAP: Record<string, ExtractedPart['type']> = {
  'cpu': 'cpu', 'processor': 'cpu',
  'gpu': 'gpu', 'graphics': 'gpu', 'graphics card': 'gpu',
  'ram': 'memory', 'memory': 'memory',
  'storage': 'storage', 'hard disk': 'storage', 'hard drive': 'storage',
  'motherboard': 'motherboard',
  'wattage': 'psu', 'power supply': 'psu',
  'cooling': 'cooling',
}

export function parseAmazon(html: string, url: string): ParsedListing {
  const root = parse(html)

  const prebuiltName = root.querySelector('#productTitle')?.text.trim() ??
    root.querySelector('h1')?.text.trim() ?? 'Unknown Product'

  const priceText = root.querySelector('.a-price .a-offscreen')?.text ??
    root.querySelector('#priceblock_ourprice')?.text ?? ''
  const prebuiltPrice = parseFloat(priceText.replace(/[^0-9.]/g, '')) || null

  const prebuiltImageUrl = root.querySelector('#landingImage')?.getAttribute('src') ?? null

  const parts: ExtractedPart[] = []
  const seen = new Set<ExtractedPart['type']>()

  const rows = root.querySelectorAll('#productDetails_techSpec_section_1 tr, .prodDetTable tr')
  for (const row of rows) {
    const label = row.querySelector('th')?.text.trim().toLowerCase() ?? ''
    const value = row.querySelector('td')?.text.trim() ?? ''
    for (const [key, type] of Object.entries(SPEC_LABEL_MAP)) {
      if (label.includes(key) && !seen.has(type) && value) {
        parts.push({ type, name: value })
        seen.add(type)
        break
      }
    }
  }

  if (parts.length < 3) {
    const bullets = root.querySelectorAll('#feature-bullets li span.a-list-item')
    const cpuPatterns = [/intel core/i, /amd ryzen/i]
    const gpuPatterns = [/rtx \d+/i, /gtx \d+/i, /radeon rx/i]
    for (const bullet of bullets) {
      const text = bullet.text.trim()
      if (!seen.has('cpu') && cpuPatterns.some(p => p.test(text))) {
        parts.push({ type: 'cpu', name: text }); seen.add('cpu')
      }
      if (!seen.has('gpu') && gpuPatterns.some(p => p.test(text))) {
        parts.push({ type: 'gpu', name: text }); seen.add('gpu')
      }
    }
  }

  return { prebuiltName, prebuiltPrice, prebuiltImageUrl, retailer: 'amazon', parts }
}
