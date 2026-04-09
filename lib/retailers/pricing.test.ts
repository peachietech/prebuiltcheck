import { describe, it, expect } from 'vitest'
import { selectLowestPrice, selectColorVariant } from './pricing'
import type { RetailerListing } from '@/types'

const listings: RetailerListing[] = [
  { retailer: 'amazon', price: 289.99, name: 'Intel Core i7-13700KF', affiliateUrl: 'https://amazon.com/dp/A?tag=x' },
  { retailer: 'bestbuy', price: 299.99, name: 'Intel Core i7-13700KF', affiliateUrl: 'https://bestbuy.com/p/1' },
  { retailer: 'walmart', price: 275.00, name: 'Intel Core i7-13700KF', affiliateUrl: 'https://walmart.com/ip/1' },
]

describe('selectLowestPrice', () => {
  it('returns the listing with the lowest price', () => {
    const result = selectLowestPrice(listings)
    expect(result.price).toBe(275.00)
    expect(result.retailer).toBe('walmart')
  })

  it('handles a single listing', () => {
    const result = selectLowestPrice([listings[0]])
    expect(result.retailer).toBe('amazon')
  })
})

describe('selectColorVariant', () => {
  const blackListings: RetailerListing[] = [
    { retailer: 'amazon', price: 29.99, name: 'Cooler Master Hyper 212 Black', affiliateUrl: 'https://amazon.com/dp/B?tag=x' },
  ]
  const whiteListings: RetailerListing[] = [
    { retailer: 'newegg', price: 34.99, name: 'Cooler Master Hyper 212 White', affiliateUrl: 'https://newegg.com/p/W' },
  ]

  it('returns lowest black variant', () => {
    const result = selectColorVariant(blackListings)
    expect(result?.name).toContain('Black')
    expect(result?.price).toBe(29.99)
  })

  it('returns lowest white variant', () => {
    const result = selectColorVariant(whiteListings)
    expect(result?.name).toContain('White')
  })

  it('returns null for empty array', () => {
    expect(selectColorVariant([])).toBeNull()
  })
})
