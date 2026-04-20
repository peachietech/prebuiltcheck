import type { ExtractedPart } from '@/types'
import { parseBestBuy } from './bestbuy'
import { parseNewegg } from './newegg'
import { parseAmazon } from './amazon'
import { parseWalmart } from './walmart'
import { parseiBUYPOWER } from './ibuypower'
import { parseCyberPowerPC } from './cyberpowerpc'
import { parseCostco } from './costco'
import { parseNZXT } from './nzxt'
import { parseHP } from './hp'

export type SupportedRetailer =
  | 'bestbuy'
  | 'newegg'
  | 'amazon'
  | 'walmart'
  | 'ibuypower'
  | 'cyberpowerpc'
  | 'costco'
  | 'nzxt'
  | 'hp'

export interface ParsedListing {
  prebuiltName: string
  prebuiltPrice: number | null
  prebuiltImageUrl: string | null
  retailer: SupportedRetailer | 'photo'
  parts: ExtractedPart[]
}

export function detectRetailer(url: string): SupportedRetailer {
  if (url.includes('bestbuy.com')) return 'bestbuy'
  if (url.includes('newegg.com')) return 'newegg'
  if (url.includes('amazon.com')) return 'amazon'
  if (url.includes('walmart.com')) return 'walmart'
  if (url.includes('ibuypower.com')) return 'ibuypower'
  if (url.includes('cyberpowerpc.com')) return 'cyberpowerpc'
  if (url.includes('costco.com')) return 'costco'
  if (url.includes('nzxt.com')) return 'nzxt'
  if (url.includes('hp.com')) return 'hp'
  throw new Error(`Unsupported retailer: ${url}`)
}

export function parsePrebuiltPage(html: string, url: string, retailer: SupportedRetailer): ParsedListing {
  switch (retailer) {
    case 'bestbuy':     return parseBestBuy(html, url)
    case 'newegg':      return parseNewegg(html, url)
    case 'amazon':      return parseAmazon(html, url)
    case 'walmart':     return parseWalmart(html, url)
    case 'ibuypower':   return parseiBUYPOWER(html, url)
    case 'cyberpowerpc':return parseCyberPowerPC(html, url)
    case 'costco':      return parseCostco(html, url)
    case 'nzxt':        return parseNZXT(html, url)
    case 'hp':          return parseHP(html, url)
  }
}
