import { NextRequest, NextResponse } from 'next/server'
import { fetchPageHtml } from '@/lib/scraping/scrapingbee'
import { detectRetailer, parsePrebuiltPage } from '@/lib/scraping/parsers'
import { findCachedComparison } from '@/lib/scraping/dedup'
import { createServerClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { url } = await req.json()

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
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
