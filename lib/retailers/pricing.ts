import type { RetailerListing } from '@/types'

export function selectLowestPrice(listings: RetailerListing[]): RetailerListing {
  return listings.reduce((min, cur) => cur.price < min.price ? cur : min)
}

export function selectColorVariant(listings: RetailerListing[]): RetailerListing | null {
  if (!listings.length) return null
  return listings.reduce((min, cur) => cur.price < min.price ? cur : min)
}
