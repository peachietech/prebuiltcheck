export type PartType = 'cpu' | 'gpu' | 'motherboard' | 'memory' | 'storage' | 'psu' | 'case' | 'cooling'

export type RetailerName = 'amazon' | 'bestbuy' | 'walmart' | 'newegg'

export interface ExtractedPart {
  type: PartType
  name: string
}

export interface RetailerListing {
  retailer: RetailerName
  price: number
  affiliateUrl: string
  name: string
}

export interface PricedPart {
  type: PartType
  name: string
  lowestPrice: number
  lowestRetailer: RetailerName
  lowestAffiliateUrl: string
  blackPrice: number | null
  blackRetailer: RetailerName | null
  blackAffiliateUrl: string | null
  whitePrice: number | null
  whiteRetailer: RetailerName | null
  whiteAffiliateUrl: string | null
}

export interface Comparison {
  id: string
  slug: string
  prebuiltUrl: string
  prebuiltName: string
  prebuiltPrice: number
  prebuiltImageUrl: string | null
  retailer: string
  parts: PricedPart[]
  createdAt: string
  expiresAt: string
}

export interface PendingComparison {
  id: string
  prebuiltUrl: string
  prebuiltName: string
  prebuiltPrice: number | null
  prebuiltImageUrl: string | null
  retailer: string
  extractedParts: ExtractedPart[]
}
