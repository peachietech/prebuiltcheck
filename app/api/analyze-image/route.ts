import { NextRequest, NextResponse } from 'next/server'
import { analyzeImageForParts } from '@/lib/scraping/imageAnalysis'
import { suggestMissingParts } from '@/lib/scraping/partUtils'
import { createServerClient } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/rateLimit'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

type AllowedMimeType = typeof ALLOWED_TYPES[number]

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

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('image')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'image file is required' }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Image must be under 10 MB' }, { status: 413 })
  }

  if (!ALLOWED_TYPES.includes(file.type as AllowedMimeType)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, WebP, or GIF images are allowed' }, { status: 415 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const mediaType = file.type as AllowedMimeType

  let result
  try {
    result = await analyzeImageForParts(base64, mediaType)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Image analysis failed: ${message}` }, { status: 502 })
  }

  if (result.parts.length === 0) {
    return NextResponse.json(
      { error: 'No PC components found in the image. Try a clearer photo or spec sheet screenshot.' },
      { status: 422 }
    )
  }

  // Fill in any missing parts with smart suggestions
  const suggestions = suggestMissingParts(result.parts)
  const allParts = [...result.parts, ...suggestions]

  // Save to pending_comparisons — same flow as URL scraping
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('pending_comparisons')
    .insert({
      prebuilt_url: null,
      prebuilt_name: result.productName ?? 'PC from photo',
      prebuilt_price: result.price,
      prebuilt_image_url: null,
      retailer: 'photo',
      extracted_parts: allParts,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to save analysis' }, { status: 500 })
  }

  return NextResponse.json({ pendingId: data.id })
}
