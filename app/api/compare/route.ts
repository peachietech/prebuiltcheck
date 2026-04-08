import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { searchAmazon } from '@/lib/retailers/amazon'
import { searchBestBuy } from '@/lib/retailers/bestbuy'
import { searchWalmart } from '@/lib/retailers/walmart'
import { selectLowestPrice, selectColorVariant } from '@/lib/retailers/pricing'
import { generateSlug } from '@/lib/slug'
import type { ExtractedPart, PricedPart, RetailerListing } from '@/types'

async function lookupPart(part: ExtractedPart): Promise<PricedPart> {
  const [amazonAny, bbAny, walmartAny] = await Promise.all([
    searchAmazon(part.name).catch(() => null),
    searchBestBuy(part.name).catch(() => null),
    searchWalmart(part.name).catch(() => null),
  ])

  const anyListings = [amazonAny, bbAny, walmartAny].filter(Boolean) as RetailerListing[]

  const [amazonBlack, bbBlack, walmartBlack, amazonWhite, bbWhite, walmartWhite] = await Promise.all([
    searchAmazon(`${part.name} black`).catch(() => null),
    searchBestBuy(`${part.name} black`).catch(() => null),
    searchWalmart(`${part.name} black`).catch(() => null),
    searchAmazon(`${part.name} white`).catch(() => null),
    searchBestBuy(`${part.name} white`).catch(() => null),
    searchWalmart(`${part.name} white`).catch(() => null),
  ])

  const blackListings = [amazonBlack, bbBlack, walmartBlack].filter(Boolean) as RetailerListing[]
  const whiteListings = [amazonWhite, bbWhite, walmartWhite].filter(Boolean) as RetailerListing[]

  const lowest = anyListings.length ? selectLowestPrice(anyListings) : null
  const black = selectColorVariant(blackListings)
  const white = selectColorVariant(whiteListings)

  if (!lowest) {
    return {
      type: part.type,
      name: part.name,
      lowestPrice: 0,
      lowestRetailer: 'amazon',
      lowestAffiliateUrl: `https://www.amazon.com/s?k=${encodeURIComponent(part.name)}&tag=${process.env.AMAZON_ASSOCIATE_TAG}`,
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
    blackPrice: black?.price ?? null,
    blackRetailer: black?.retailer ?? null,
    blackAffiliateUrl: black?.affiliateUrl ?? null,
    whitePrice: white?.price ?? null,
    whiteRetailer: white?.retailer ?? null,
    whiteAffiliateUrl: white?.affiliateUrl ?? null,
  }
}

export async function POST(req: NextRequest) {
  const { pendingId, confirmedParts } = await req.json()

  if (!pendingId || !Array.isArray(confirmedParts)) {
    return NextResponse.json({ error: 'pendingId and confirmedParts are required' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data: pending, error: pendingErr } = await supabase
    .from('pending_comparisons')
    .select('*')
    .eq('id', pendingId)
    .single()

  if (pendingErr || !pending) {
    return NextResponse.json({ error: 'Pending comparison not found' }, { status: 404 })
  }

  const pricedParts = await Promise.all(
    (confirmedParts as ExtractedPart[]).map(lookupPart)
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

  if (compErr) {
    return NextResponse.json({ error: 'Failed to save comparison' }, { status: 500 })
  }

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
