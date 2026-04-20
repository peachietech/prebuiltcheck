import 'server-only'
import { createServerClient } from '@/lib/supabase'
import type { RetailerListing, RetailerName } from '@/types'

/** Successful results stay fresh for 8 hours. */
const CACHE_TTL_MS = 8 * 60 * 60 * 1000
/** All-null results (every retailer failed) re-expire after 1 hour so transient failures don't stick. */
const NULL_TTL_MS = 1 * 60 * 60 * 1000

/**
 * One row in price_cache.results — each retailer maps to a listing object
 * (price found) or null (was searched but nothing usable came back).
 * Storing nulls lets us skip re-querying retailers that consistently return
 * nothing for a given part, until the TTL expires.
 */
export type CachedResults = Partial<Record<RetailerName, RetailerListing | null>>

/**
 * Canonical cache key for a part lookup.
 *
 * - Normalises whitespace and case so minor name variations hit the same row.
 * - For motherboards, appends the DDR generation so a DDR4 build and a DDR5
 *   build don't share a cached board (they need slot-compatible results).
 */
export function makeCacheKey(
  type: string,
  name: string,
  memoryType?: string
): string {
  const base = `${type}:${name.trim().toLowerCase().replace(/\s+/g, ' ')}`
  return type === 'motherboard' && memoryType
    ? `${base}:${memoryType.toLowerCase()}`
    : base
}

/**
 * Returns the cached retailer results for a search key if they are still
 * within the TTL window, otherwise returns null (cache miss or stale).
 * Failures (Supabase unavailable, table not yet migrated) are swallowed so
 * the rest of the lookup can proceed normally.
 */
export async function getCached(key: string): Promise<CachedResults | null> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('price_cache')
      .select('results, fetched_at')
      .eq('search_key', key)
      .single()

    if (!data) return null

    const ageMs = Date.now() - new Date(data.fetched_at).getTime()
    const results = data.results as CachedResults
    const allNull = Object.keys(results).length > 0 &&
      Object.values(results).every(v => v === null)
    const ttl = allNull ? NULL_TTL_MS : CACHE_TTL_MS
    if (ageMs > ttl) return null

    return results
  } catch {
    return null
  }
}

/**
 * Upserts a fresh set of retailer results for a search key.
 * Call this after a live retailer fetch completes.
 * Failures are silently swallowed — a failed cache write must never surface
 * as an error to the user.
 */
export async function setCache(
  key: string,
  results: CachedResults
): Promise<void> {
  try {
    const supabase = createServerClient()
    await supabase
      .from('price_cache')
      .upsert(
        { search_key: key, results, fetched_at: new Date().toISOString() },
        { onConflict: 'search_key' }
      )
  } catch {
    // Cache write failure must not break the comparison
  }
}
