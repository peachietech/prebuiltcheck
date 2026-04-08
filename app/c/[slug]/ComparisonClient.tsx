'use client'

import { useState } from 'react'
import ComparisonHeader from '@/components/ComparisonHeader'
import ColorToggle from '@/components/ColorToggle'
import WindowsToggle from '@/components/WindowsToggle'
import PartsTable from '@/components/PartsTable'
import type { PricedPart } from '@/types'

type ColorFilter = 'lowest' | 'black' | 'white'

interface Props {
  prebuiltName: string
  retailer: string
  prebuiltPrice: number
  slug: string
  parts: PricedPart[]
}

function getBuildTotal(parts: PricedPart[], filter: ColorFilter): number {
  return parts.reduce((sum, part) => {
    if (filter === 'black' && part.blackPrice) return sum + part.blackPrice
    if (filter === 'white' && part.whitePrice) return sum + part.whitePrice
    return sum + part.lowestPrice
  }, 0)
}

export default function ComparisonClient({ prebuiltName, retailer, prebuiltPrice, slug, parts }: Props) {
  const [colorFilter, setColorFilter] = useState<ColorFilter>('lowest')
  const [windowsEnabled, setWindowsEnabled] = useState(false)

  const buildTotal = getBuildTotal(parts, colorFilter)

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
        buildTotal={buildTotal}
        windowsEnabled={windowsEnabled}
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
      <PartsTable parts={parts} colorFilter={colorFilter} />
    </>
  )
}
