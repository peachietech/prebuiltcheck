import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { searchAmazon } from '@/lib/retailers/amazon'
import { searchBestBuy } from '@/lib/retailers/bestbuy'
import { searchWalmart } from '@/lib/retailers/walmart'
import { searchNewegg } from '@/lib/retailers/newegg'
import { selectLowestPrice } from '@/lib/retailers/pricing'
import { getCached, setCache, makeCacheKey, type CachedResults } from '@/lib/retailers/cache'
import { generateSlug } from '@/lib/slug'
import type { ExtractedPart, PricedPart, RetailerListing } from '@/types'

const MAX_PARTS = 12
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_PART_TYPES = new Set(['cpu','gpu','motherboard','memory','storage','psu','case','cooling'])

function isValidPart(p: unknown): p is ExtractedPart {
  if (typeof p !== 'object' || p === null) return false
  const part = p as Record<string, unknown>
  return (
    typeof part.name === 'string' &&
    part.name.length <= 300 &&
    VALID_PART_TYPES.has(part.type as string)
  )
}

/** 300ms pause used only on cache misses to avoid hammering retailer APIs. */
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Build a PricedPart from the lowest listing found (or a search-link fallback). */
function buildPricedPart(part: ExtractedPart, lowest: RetailerListing | null): PricedPart {
  if (!lowest) {
    const bbTag = process.env.BESTBUY_AFFILIATE_TAG ?? ''
    const bbSearch = `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(part.name)}`
    const fallbackUrl = bbTag
      ? `https://bestbuy.7tiv.net/c/${bbTag}/${encodeURIComponent(bbSearch)}`
      : bbSearch
    return {
      type: part.type,
      name: part.name,
      lowestPrice: 0,
      lowestRetailer: 'bestbuy',
      lowestAffiliateUrl: fallbackUrl,
      blackPrice: null, blackRetailer: null, blackAffiliateUrl: null,
      whitePrice: null, whiteRetailer: null, whiteAffiliateUrl: null,
    }
  }

  return {
    type: part.type,
    name: part.name,
    lowestPrice: lowest.price,
    lowestRetailer: lowest.retailer,
    lowestAffiliateUrl: lowest.affiliateUrl,
    blackPrice: null, blackRetailer: null, blackAffiliateUrl: null,
    whitePrice: null, whiteRetailer: null, whiteAffiliateUrl: null,
  }
}

/**
 * Look up the best retail price for a single part.
 *
 * Flow:
 *   1. Check price_cache — if fresh, return immediately (no retailer API calls).
 *   2. On cache miss, stagger (to respect Best Buy rate limits), fetch all
 *      retailers in parallel, write results back to cache, then return lowest.
 *
 * @param missIndex - position among cache-miss parts, used for stagger timing
 * @param memoryType - 'DDR4' or 'DDR5', passed to motherboard queries for
 *   slot-compatibility filtering
 */
async function lookupPart(
  part: ExtractedPart,
  missIndex: number,
  memoryType?: string
): Promise<PricedPart> {
  const cacheKey = makeCacheKey(part.type, part.name, memoryType)
  const cached = await getCached(cacheKey)

  if (cached !== null) {
    // Cache hit — build the result from stored data, no API calls needed
    const listings = Object.values(cached).filter(Boolean) as RetailerListing[]
    return buildPricedPart(part, listings.length ? selectLowestPrice(listings) : null)
  }

  // Cache miss — stagger only among parts that actually need live fetches
  await sleep(missIndex * 300)

  const [amazonResult, bbResult, walmartResult, neweggResult] = await Promise.all([
    searchAmazon(part.name).catch(() => null),
    searchBestBuy(part.name, part.type, memoryType).catch(() => null),
    searchWalmart(part.name, part.type, memoryType).catch(() => null),
    searchNewegg(part.name, part.type, memoryType).catch(() => null),
  ])

  // Persist results (including nulls) so subsequent lookups are instant
  const results: CachedResults = {
    amazon: amazonResult,
    bestbuy: bbResult,
    walmart: walmartResult,
    newegg: neweggResult,
  }
  await setCache(cacheKey, results)

  const listings = [amazonResult, bbResult, walmartResult, neweggResult]
    .filter(Boolean) as RetailerListing[]

  return buildPricedPart(part, listings.length ? selectLowestPrice(listings) : null)
}

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const { pendingId, confirmedParts } = (body ?? {}) as Record<string, unknown>

  if (typeof pendingId !== 'string' || !UUID_RE.test(pendingId))
    return NextResponse.json({ error: 'pendingId must be a valid UUID' }, { status: 400 })

  if (!Array.isArray(confirmedParts))
    return NextResponse.json({ error: 'confirmedParts must be an array' }, { status: 400 })

  if (confirmedParts.length === 0)
    return NextResponse.json({ error: 'confirmedParts must not be empty' }, { status: 400 })

  if (confirmedParts.length > MAX_PARTS)
    return NextResponse.json({ error: `Too many parts (max ${MAX_PARTS})` }, { status: 400 })

  if (!confirmedParts.every(isValidPart))
    return NextResponse.json({ error: 'One or more parts are invalid' }, { status: 400 })

  const supabase = createServerClient()

  const { data: pending, error: pendingErr } = await supabase
    .from('pending_comparisons')
    .select('*')
    .eq('id', pendingId)
    .single()

  if (pendingErr || !pending)
    return NextResponse.json({ error: 'Pending comparison not found' }, { status: 404 })

  // Detect DDR generation from the memory part so motherboard cache keys and
  // search queries are scoped to the correct slot type (DDR4 ≠ DDR5).
  const memoryPart = confirmedParts.find(p => p.type === 'memory')
  const memoryType = memoryPart?.name.match(/DDR([45])/i)?.[0]?.toUpperCase() as
    | 'DDR4'
    | 'DDR5'
    | undefined

  // Phase 1: read price_cache for all parts in parallel.
  // Parts that already have fresh cached prices won't need any retailer calls.
  const cacheKeys = confirmedParts.map(p => makeCacheKey(p.type, p.name, memoryType))
  const cachedAll = await Promise.all(cacheKeys.map(k => getCached(k)))

  // Phase 2: assign a stagger index only to parts that missed the cache,
  // so we don't add unnecessary delay for parts we already have prices for.
  let missCounter = 0
  const pricedParts = await Promise.all(
    confirmedParts.map(async (part, i) => {
      if (cachedAll[i] !== null) {
        // Fast path: serve from cache
        const listings = Object.values(cachedAll[i]!).filter(Boolean) as RetailerListing[]
        return buildPricedPart(part, listings.length ? selectLowestPrice(listings) : null)
      }
      // Slow path: live retailer fetch, staggered
      return lookupPart(part, missCounter++, memoryType)
    })
  )

  const slug = generateSlug()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: comparison, error: compErr } = await supabase
    .from('comparisons')
    .insert({
      slug,
      prebuilt_url: pending.prebuilt_url,
      prebuilt_name: pending.prebuilt_name,
      prebuilt_price: pending.prebuilt_price,
      prebuilt_image_url: pending.prebuilt_image_url,
      retailer: pending.retailer,
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (compErr)
    return NextResponse.json({ error: 'Failed to save comparison' }, { status: 500 })

  await supabase.from('parts').insert(
    pricedParts.map(p => ({
      comparison_id: comparison.id,
      type: p.type,
      name: p.name,
      lowest_price: p.lowestPrice,
      lowest_retailer: p.lowestRetailer,
      lowest_affiliate_url: p.lowestAffiliateUrl,
      black_price: p.blackPrice,
      black_retailer: p.blackRetailer,
      black_affiliate_url: p.blackAffiliateUrl,
      white_price: p.whitePrice,
      white_retailer: p.whiteRetailer,
      white_affiliate_url: p.whiteAffiliateUrl,
    }))
  )

  await supabase.from('pending_comparisons').delete().eq('id', pendingId)

  return NextResponse.json({ slug })
}
