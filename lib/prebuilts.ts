import 'server-only'
import { createServerClient } from '@/lib/supabase'
import type { ExtractedPart } from '@/types'

// ── GPU tier rankings ─────────────────────────────────────────────────────────
// Higher number = faster card. Roughly calibrated to rasterization performance.
// Update when new GPU generations launch.
const GPU_TIERS: Record<string, number> = {
  // RTX 50 series
  'RTX 5090': 100, 'RTX 5080': 90, 'RTX 5070 Ti': 83,
  'RTX 5070': 76,  'RTX 5060 Ti': 68, 'RTX 5060': 60,
  // RX 9000 series
  'RX 9070 XT': 79, 'RX 9070': 71,
  // RTX 40 series
  'RTX 4090': 98,  'RTX 4080 Super': 88, 'RTX 4080': 85,
  'RTX 4070 Ti Super': 79, 'RTX 4070 Ti': 76, 'RTX 4070 Super': 71,
  'RTX 4070': 65,  'RTX 4060 Ti': 57, 'RTX 4060': 50,
  // RTX 30 series
  'RTX 3090 Ti': 85, 'RTX 3090': 82, 'RTX 3080 Ti': 79, 'RTX 3080': 73,
  'RTX 3070 Ti': 66, 'RTX 3070': 61, 'RTX 3060 Ti': 55, 'RTX 3060': 47,
  'RTX 3050': 35,
  // GTX
  'GTX 1660 Ti': 32, 'GTX 1660 Super': 31, 'GTX 1660': 28,
  // RX 7000 series
  'RX 7900 XTX': 95, 'RX 7900 XT': 89, 'RX 7900 GRE': 81,
  'RX 7800 XT': 72,  'RX 7700 XT': 63, 'RX 7600 XT': 52, 'RX 7600': 48,
  // RX 6000 series
  'RX 6900 XT': 83, 'RX 6800 XT': 76, 'RX 6800': 70,
  'RX 6700 XT': 62, 'RX 6700': 57, 'RX 6600 XT': 48, 'RX 6600': 43,
}

// ── CPU tier rankings ─────────────────────────────────────────────────────────
const CPU_TIERS: Record<string, number> = {
  // Ryzen 9000 / X3D
  'Ryzen 9 9950X3D': 100, 'Ryzen 9 9900X3D': 95,
  'Ryzen 7 9800X3D': 92,  'Ryzen 9 9950X': 87, 'Ryzen 9 9900X': 82,
  'Ryzen 7 9700X': 76,    'Ryzen 5 9600X': 70, 'Ryzen 5 9600': 65,
  // Ryzen 7000 / X3D
  'Ryzen 9 7950X3D': 98,  'Ryzen 9 7900X3D': 91,
  'Ryzen 7 7800X3D': 88,  'Ryzen 9 7950X': 85, 'Ryzen 9 7900X': 80,
  'Ryzen 7 7700X': 74,    'Ryzen 5 7600X': 68, 'Ryzen 5 7600': 63,
  // Intel Core Ultra 200 (Arrow Lake)
  'Core Ultra 9 285K': 96, 'Core Ultra 7 265K': 88, 'Core Ultra 5 245K': 80,
  // Intel 14th gen
  'Core i9-14900K': 93,  'Core i9-14900KF': 92,
  'Core i7-14700K': 87,  'Core i7-14700KF': 86, 'Core i7-14700F': 82,
  'Core i5-14600K': 79,  'Core i5-14600KF': 78, 'Core i5-14400F': 67,
  // Intel 13th gen
  'Core i9-13900K': 90,  'Core i7-13700K': 85, 'Core i5-13600K': 77,
  'Core i5-13400F': 61,
  // Ryzen 5000
  'Ryzen 9 5950X': 79,   'Ryzen 9 5900X': 74,
  'Ryzen 7 5800X3D': 82, 'Ryzen 7 5800X': 70,
  'Ryzen 5 5600X': 63,   'Ryzen 5 5600': 59,
}

/** Return GPU tier for a model string, or undefined if unknown. */
export function getGpuTier(model: string): number | undefined {
  const clean = model.replace(/NVIDIA GeForce\s+|AMD Radeon\s+/gi, '').trim()
  // Try exact match first, then prefix match (handles VRAM variants like "RTX 5060 12GB")
  for (const [key, tier] of Object.entries(GPU_TIERS)) {
    if (clean.toLowerCase().startsWith(key.toLowerCase())) return tier
  }
  return undefined
}

/** Return CPU tier for a model string, or undefined if unknown. */
export function getCpuTier(model: string): number | undefined {
  const clean = model.replace(/Intel\s+|AMD\s+/gi, '').trim()
  for (const [key, tier] of Object.entries(CPU_TIERS)) {
    if (clean.toLowerCase().includes(key.toLowerCase())) return tier
  }
  return undefined
}

/** Parse GB from strings like "32GB DDR5", "2TB NVMe SSD". */
function parseGb(name: string): number | undefined {
  const m = name.match(/(\d+(?:\.\d+)?)\s*(TB|GB)/i)
  if (!m) return undefined
  const val = parseFloat(m[1])
  return m[2].toUpperCase() === 'TB' ? Math.round(val * 1024) : Math.round(val)
}

interface PrebuiltSpec {
  url: string
  name: string
  retailer: string
  price: number
  imageUrl: string | null
  parts: ExtractedPart[]
}

/**
 * Upsert a prebuilt into the known_prebuilts catalog.
 * Called automatically after each successful URL analysis.
 * Failures are swallowed so they never block the scrape flow.
 */
export async function upsertKnownPrebuilt(spec: PrebuiltSpec): Promise<void> {
  if (!spec.price || spec.price <= 0) return

  const gpuPart = spec.parts.find(p => p.type === 'gpu')
  const cpuPart = spec.parts.find(p => p.type === 'cpu')
  const memPart = spec.parts.find(p => p.type === 'memory')
  const storagePart = spec.parts.find(p => p.type === 'storage')

  const gpuModel = gpuPart?.name ?? null
  const cpuModel = cpuPart?.name ?? null
  const gpuTier = gpuModel ? getGpuTier(gpuModel) ?? null : null
  const cpuTier = cpuModel ? getCpuTier(cpuModel) ?? null : null
  const ramGb = memPart ? parseGb(memPart.name) ?? null : null
  const storageGb = storagePart ? parseGb(storagePart.name) ?? null : null

  try {
    const supabase = createServerClient()
    await supabase.from('known_prebuilts').upsert(
      {
        url: spec.url,
        name: spec.name,
        retailer: spec.retailer,
        price: spec.price,
        gpu_model: gpuModel,
        gpu_tier: gpuTier,
        cpu_model: cpuModel,
        cpu_tier: cpuTier,
        ram_gb: ramGb,
        storage_gb: storageGb,
        image_url: spec.imageUrl,
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'url' }
    )
  } catch {
    // Never block the scrape flow on a catalog write failure
  }
}

export interface SimilarPrebuiltRow {
  id: string
  url: string
  name: string
  retailer: string
  price: number
  imageUrl: string | null
}

/**
 * Find cheaper prebuilts with equivalent or better specs.
 *
 * Matching rules:
 *   - GPU tier ≥ submitted tier (same performance class or better)
 *   - CPU tier ≥ submitted tier × 0.85 (within ~15%, or better)
 *   - RAM ≥ submitted RAM
 *   - Price at least 8% lower than submitted price
 *   - Not the same URL
 */
export async function getSimilarPrebuilts(
  currentUrl: string,
  currentPrice: number,
  gpuTier: number | null,
  cpuTier: number | null,
  ramGb: number | null,
  limit = 4
): Promise<SimilarPrebuiltRow[]> {
  if (!gpuTier && !cpuTier) return []   // nothing to match on

  try {
    const supabase = createServerClient()
    let query = supabase
      .from('known_prebuilts')
      .select('id, url, name, retailer, price, image_url')
      .neq('url', currentUrl)
      .lt('price', currentPrice * 0.92)
      .order('price', { ascending: true })
      .limit(limit)

    if (gpuTier) query = query.gte('gpu_tier', gpuTier)
    if (cpuTier) query = query.gte('cpu_tier', Math.floor(cpuTier * 0.85))
    if (ramGb)   query = query.gte('ram_gb', ramGb)

    const { data } = await query
    return (data ?? []).map(row => ({
      id: row.id,
      url: row.url,
      name: row.name,
      retailer: row.retailer,
      price: row.price,
      imageUrl: row.image_url,
    }))
  } catch {
    return []
  }
}
