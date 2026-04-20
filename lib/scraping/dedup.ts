import { createServerClient } from '@/lib/supabase'

const CACHE_HOURS = 24

export async function findCachedComparison(url: string): Promise<string | null> {
  const supabase = createServerClient()
  const cutoff = new Date(Date.now() - CACHE_HOURS * 60 * 60 * 1000).toISOString()

  const { data } = await supabase
    .from('comparisons')
    .select('slug, created_at')
    .eq('prebuilt_url', url)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)

  return data && data.length > 0 ? data[0].slug : null
}
