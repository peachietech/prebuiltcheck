import { NextRequest, NextResponse } from 'next/server'
import { fetchPageHtml } from '@/lib/scraping/scrapingbee'
import { fetchBestBuyProduct } from '@/lib/scraping/bestbuyApi'
import { fetchNZXTProduct } from '@/lib/scraping/nzxtApi'
import { detectRetailer, parsePrebuiltPage } from '@/lib/scraping/parsers'
import { findCachedComparison } from '@/lib/scraping/dedup'
import { createServerClient } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/rateLimit'

const MAX_URL_LENGTH = 2048
const ALLOWED_PROTOCOLS = ['https:', 'http:']
const BLOCKED_HOSTNAMES = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254']

function validateUrl(raw: string): { valid: boolean; reason?: string } {
  if (raw.length > MAX_URL_LENGTH) return { valid: false, reason: 'URL too long' }
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { valid: false, reason: 'Invalid URL' }
  }
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return { valid: false, reason: 'URL must use http or https' }
  }
  if (BLOCKED_HOSTNAMES.some(h => parsed.hostname === h || parsed.hostname.endsWith('.local'))) {
    return { valid: false, reason: 'Invalid URL' }
  }
  return { valid: true }
}

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { allowed, retryAfter } = checkRateLimit(ip)
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${retryAfter}s.` },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  // Parse body safely
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || !('url' in body)) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  const url = (body as Record<string, unknown>).url
  if (typeof url !== 'string') {
    return NextResponse.json({ error: 'url must be a string' }, { status: 400 })
  }

  // Validate URL (SSRF protection)
  const { valid, reason } = validateUrl(url)
  if (!valid) {
    return NextResponse.json({ error: reason }, { status: 422 })
  }

  // Dedup check
  const cachedSlug = await findCachedComparison(url)
  if (cachedSlug) {
    return NextResponse.json({ redirect: `/c/${cachedSlug}` })
  }

  let retailer: ReturnType<typeof detectRetailer>
  try {
    retailer = detectRetailer(url)
  } catch {
    return NextResponse.json({ error: 'Unsupported retailer URL' }, { status: 422 })
  }

  // NZXT: Shopify store — use /products/{handle}.json directly (free, no key)
  if (retailer === 'nzxt') {
    try {
      const parsed = await fetchNZXTProduct(url)
      const supabase = createServerClient()
      const { data, error } = await supabase
        .from('pending_comparisons')
        .insert({
          prebuilt_url: url,
          prebuilt_name: parsed.prebuiltName,
          prebuilt_price: parsed.prebuiltPrice,
          prebuilt_image_url: parsed.prebuiltImageUrl,
          retailer,
          extracted_parts: parsed.parts,
        })
        .select('id')
        .single()

      if (error) return NextResponse.json({ error: 'Failed to save pending comparison' }, { status: 500 })
      return NextResponse.json({ pendingId: data.id })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return NextResponse.json({ error: `NZXT lookup failed: ${message}` }, { status: 502 })
    }
  }

  // Best Buy: use Products API directly — instant, no scraping credits needed
  if (retailer === 'bestbuy') {
    try {
      const parsed = await fetchBestBuyProduct(url)
      const supabase = createServerClient()
      const { data, error } = await supabase
        .from('pending_comparisons')
        .insert({
          prebuilt_url: url,
          prebuilt_name: parsed.prebuiltName,
          prebuilt_price: parsed.prebuiltPrice,
          prebuilt_image_url: parsed.prebuiltImageUrl,
          retailer,
          extracted_parts: parsed.parts,
        })
        .select('id')
        .single()

      if (error) return NextResponse.json({ error: 'Failed to save pending comparison' }, { status: 500 })
      return NextResponse.json({ pendingId: data.id })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return NextResponse.json({ error: `Best Buy lookup failed: ${message}` }, { status: 502 })
    }
  }

  // All other retailers: scrape via ScrapingBee
  let html: string
  try {
    html = await fetchPageHtml(url)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Scraping failed: ${message}` }, { status: 502 })
  }

  const parsed = parsePrebuiltPage(html, url, retailer)

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('pending_comparisons')
    .insert({
      prebuilt_url: url,
      prebuilt_name: parsed.prebuiltName,
      prebuilt_price: parsed.prebuiltPrice,
      prebuilt_image_url: parsed.prebuiltImageUrl,
      retailer,
      extracted_parts: parsed.parts,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to save pending comparison' }, { status: 500 })
  }

  return NextResponse.json({ pendingId: data.id })
}
