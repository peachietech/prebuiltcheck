'use client'

import { useState } from 'react'
import ComparisonHeader from '@/components/ComparisonHeader'
import ColorToggle from '@/components/ColorToggle'
import WindowsToggle from '@/components/WindowsToggle'
import PartsTable from '@/components/PartsTable'
import type { PricedPart, PartType, RetailerName } from '@/types'

type ColorFilter = 'lowest' | 'black' | 'white'

export interface SimilarPrebuilt {
  id: string
  url: string
  name: string
  retailer: string
  price: number
  imageUrl: string | null
}

interface Props {
  prebuiltName: string
  retailer: string
  prebuiltPrice: number
  prebuiltImageUrl: string | null
  affiliatePrebuiltUrl: string | null
  slug: string
  parts: PricedPart[]
  similarPrebuilts?: SimilarPrebuilt[]
}

function getBuildTotal(parts: PricedPart[], filter: ColorFilter): number {
  return parts.reduce((sum, part) => {
    if (filter === 'black' && part.blackPrice) return sum + part.blackPrice
    if (filter === 'white' && part.whitePrice) return sum + part.whitePrice
    return sum + part.lowestPrice
  }, 0)
}

const RETAILER_LABELS: Record<string, string> = {
  bestbuy: 'Best Buy', newegg: 'Newegg', amazon: 'Amazon', walmart: 'Walmart',
  ibuypower: 'iBUYPOWER', cyberpowerpc: 'CyberPowerPC', costco: 'Costco', nzxt: 'NZXT', hp: 'HP',
}

export default function ComparisonClient({
  prebuiltName, retailer, prebuiltPrice, prebuiltImageUrl, affiliatePrebuiltUrl,
  slug, parts: initialParts, similarPrebuilts,
}: Props) {
  const [parts, setParts] = useState<PricedPart[]>(initialParts)
  const [colorFilter, setColorFilter] = useState<ColorFilter>('lowest')
  const [windowsEnabled, setWindowsEnabled] = useState(false)

  const buildTotal = getBuildTotal(parts, colorFilter)
  const hasMissingParts = parts.some(p => p.lowestPrice === 0)

  /**
   * Called by PartsTable when the user submits a replacement name for a missing
   * part row. Hits /api/search-part and patches that index in local state.
   */
  async function replacePart(index: number, name: string, type: PartType) {
    const res = await fetch('/api/search-part', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type }),
    })
    if (!res.ok) throw new Error('Not found')

    const { price, retailer: r, affiliateUrl, productName } = await res.json()
    setParts(prev => prev.map((p, i) =>
      i === index
        ? { ...p, name: productName ?? name, lowestPrice: price, lowestRetailer: r as RetailerName, lowestAffiliateUrl: affiliateUrl }
        : p
    ))
  }

  async function handleShare() {
    const url = `${window.location.origin}/c/${slug}`
    await navigator.clipboard.writeText(url)
    alert('Link copied to clipboard!')
  }

  return (
    <>
      <ComparisonHeader
        prebuiltName={prebuiltName}
        retailer={retailer}
        prebuiltPrice={prebuiltPrice}
        prebuiltImageUrl={prebuiltImageUrl}
        affiliatePrebuiltUrl={affiliatePrebuiltUrl}
        buildTotal={buildTotal}
        windowsEnabled={windowsEnabled}
        hasMissingParts={hasMissingParts}
      />
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <ColorToggle value={colorFilter} onChange={setColorFilter} />
        <div className="flex items-center gap-2">
          <WindowsToggle enabled={windowsEnabled} onChange={setWindowsEnabled} />
          <button onClick={handleShare}
            className="bg-[#1e1e2e] text-[#9ca3af] hover:text-white border border-[#2d2d4a] rounded-lg px-3.5 py-2 text-[12px] transition-colors">
            Share
          </button>
          <button className="bg-[#6366f1] text-white rounded-lg px-3.5 py-2 text-[12px] font-semibold">
            Save
          </button>
        </div>
      </div>

      <PartsTable parts={parts} colorFilter={colorFilter} onReplacePart={replacePart} />

      {/* Similar prebuilts section */}
      {similarPrebuilts && similarPrebuilts.length > 0 && (
        <div className="mt-10">
          <h2 className="text-[15px] font-bold mb-1">Similar builds for less</h2>
          <p className="text-[12px] text-[#6b7280] mb-4">
            These prebuilts have comparable specs at a lower price.
          </p>
          <div className="flex flex-col gap-2">
            {similarPrebuilts.map(pb => (
              <a
                key={pb.id}
                href={pb.url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="flex items-center gap-4 bg-[#141420] hover:bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl px-4 py-3 transition-colors"
              >
                {pb.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pb.imageUrl} alt={pb.name} className="w-12 h-12 object-contain rounded shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#e5e7eb] truncate">{pb.name}</p>
                  <p className="text-[11px] text-[#6b7280] mt-0.5">{RETAILER_LABELS[pb.retailer] ?? pb.retailer}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[15px] font-bold text-[#4ade80]">${pb.price.toFixed(2)}</p>
                  <p className="text-[10px] text-[#6b7280]">saves ${(prebuiltPrice - pb.price).toFixed(0)}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
