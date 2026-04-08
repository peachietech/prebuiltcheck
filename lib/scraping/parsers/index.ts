import type { ExtractedPart } from '@/types'
import { parseBestBuy } from './bestbuy'
import { parseNewegg } from './newegg'
import { parseAmazon } from './amazon'
import { parseWalmart } from './walmart'

export type SupportedRetailer = 'bestbuy' | 'newegg' | 'amazon' | 'walmart'

export interface ParsedListing {
  prebuiltName: string
  prebuiltPrice: number | null
  prebuiltImageUrl: string | null
  retailer: SupportedRetailer
  parts: ExtractedPart[]
}

export function detectRetailer(url: string): SupportedRetailer {
  if (url.includes('bestbuy.com')) return 'bestbuy'
  if (url.includes('newegg.com')) return 'newegg'
  if (url.includes('amazon.com')) return 'amazon'
  if (url.includes('walmart.com')) return 'walmart'
  throw new Error(`Unsupported retailer: ${url}`)
}

export function parsePrebuiltPage(html: string, url: string, retailer: SupportedRetailer): ParsedListing {
  switch (retailer) {
    case 'bestbuy': return parseBestBuy(html, url)
    case 'newegg': return parseNewegg(html, url)
    case 'amazon': return parseAmazon(html, url)
    case 'walmart': return parseWalmart(html, url)
  }
}
