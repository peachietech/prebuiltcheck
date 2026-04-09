import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { searchAmazon } from '@/lib/retailers/amazon'
import { searchBestBuy } from '@/lib/retailers/bestbuy'
import { searchWalmart } from '@/lib/retailers/walmart'
import { searchNewegg } from '@/lib/retailers/newegg'
import { selectLowestPrice } from '@/lib/retailers/pricing'
import { getCached, setCache, makeCacheKey, type CachedResults } from '@/lib/retailers/cache'
import type { PartType, RetailerListing } from '@/types'

const VALID_PART_TYPES = new Set<PartType>([
  'cpu', 'gpu', 'motherboard', 'memory', 'storage', 'psu', 'case', 'cooling',
])

/**
 * POST /api/search-part
 *
 * Single-part price lookup used when a comparison row has no price and the
 * user wants to substitute a more specific part name.
 *
 * Body: { name: string, type: PartType, memoryType?: string }
 *
 * Returns: { price, retailer, affiliateUrl, productName }
 *       or 404 if no retailer finds the part.
 */
export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { name, type, memoryType } = (body ?? {}) as Record<string, unknown>

  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 300)
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 })

  if (typeof type !== 'string' || !VALID_PART_TYPES.has(type as PartType))
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  const partType = type as PartType
  const ddr = typeof memoryType === 'string' ? memoryType : undefined

  const cacheKey = makeCacheKey(partType, name.trim(), ddr)
  const cached = await getCached(cacheKey)

  if (cached !== null) {
    const listings = Object.values(cached).filter(Boolean) as RetailerListing[]
    if (listings.length) {
      const lowest = selectLowestPrice(listings)
      return NextResponse.json({
        price: lowest.price,
        retailer: lowest.retailer,
        affiliateUrl: lowest.affiliateUrl,
        productName: lowest.name,
      })
    }
    // Cached "no result" — still return 404
    return NextResponse.json({ error: 'No results found' }, { status: 404 })
  }

  // Cache miss — hit all retailers in parallel (no stagger needed for one-off search)
  const [amazonResult, bbResult, walmartResult, neweggResult] = await Promise.all([
    searchAmazon(name).catch(() => null),
    searchBestBuy(name, partType, ddr).catch(() => null),
    searchWalmart(name, partType, ddr).catch(() => null),
    searchNewegg(name, partType, ddr).catch(() => null),
  ])

  const results: CachedResults = {
    amazon: amazonResult,
    bestbuy: bbResult,
    walmart: walmartResult,
    newegg: neweggResult,
  }
  await setCache(cacheKey, results)

  const listings = [amazonResult, bbResult, walmartResult, neweggResult]
    .filter(Boolean) as RetailerListing[]

  if (!listings.length)
    return NextResponse.json({ error: 'No results found' }, { status: 404 })

  const lowest = selectLowestPrice(listings)
  return NextResponse.json({
    price: lowest.price,
    retailer: lowest.retailer,
    affiliateUrl: lowest.affiliateUrl,
    productName: lowest.name,
  })
}
