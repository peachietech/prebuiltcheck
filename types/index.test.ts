import { describe, it, expect } from 'vitest'
import type { ExtractedPart, PricedPart, PartType } from './index'

describe('types', () => {
  it('ExtractedPart accepts valid part types', () => {
    const validTypes: PartType[] = ['cpu', 'gpu', 'motherboard', 'memory', 'storage', 'psu', 'case', 'cooling']
    const parts: ExtractedPart[] = validTypes.map(type => ({ type, name: 'Test Part' }))
    expect(parts).toHaveLength(8)
  })

  it('PricedPart allows null color fields', () => {
    const part: PricedPart = {
      type: 'cpu',
      name: 'Intel Core i7',
      lowestPrice: 289,
      lowestRetailer: 'amazon',
      lowestAffiliateUrl: 'https://amazon.com/dp/ABC?tag=test',
      blackPrice: null,
      blackRetailer: null,
      blackAffiliateUrl: null,
      whitePrice: null,
      whiteRetailer: null,
      whiteAffiliateUrl: null,
    }
    expect(part.blackPrice).toBeNull()
  })
})
