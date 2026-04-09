import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { searchAmazon } from '@/lib/retailers/amazon'
import { searchBestBuy } from '@/lib/retailers/bestbuy'
import { searchWalmart } from '@/lib/retailers/walmart'
import { selectLowestPrice } from '@/lib/retailers/pricing'
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

/** 250ms pause — keeps us well under Best Buy's per-second limit */
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function lookupPart(part: ExtractedPart, index: number): Promise<PricedPart> {
  // Stagger requests: part 0 at 0ms, part 1 at 250ms, part 2 at 500ms …
  // This prevents all 8 parts from hammering Best Buy simultaneously.
  await sleep(index * 300)

  const [amazonResult, bbResult, walmartResult] = await Promise.all([
    searchAmazon(part.name).catch(() => null),
    searchBestBuy(part.name, part.type).catch(() => null),
    searchWalmart(part.name).catch(() => null),
  ])

  const listings = [amazonResult, bbResult, walmartResult].filter(Boolean) as RetailerListing[]
  const lowest = listings.length ? selectLowestPrice(listings) : null

  if (!lowest) {
    // Fallback: affiliate-tagged Best Buy search link so user can click through manually
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
    // Color variants not used for PC components — cases are the exception
    // but we keep schema null so front-end works without changes
    blackPrice: null, blackRetailer: null, blackAffiliateUrl: null,
    whitePrice: null, whiteRetailer: null, whiteAffiliateUrl: null,
  }
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

  // Look up prices for all parts — staggered to avoid API rate limits
  const pricedParts = await Promise.all(
    confirmedParts.map((part, i) => lookupPart(part, i))
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
