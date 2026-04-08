'use client'

import type { PricedPart, PartType, RetailerName } from '@/types'

const PART_LABELS: Record<PartType, string> = {
  cpu: 'CPU', gpu: 'GPU', motherboard: 'Motherboard', memory: 'Memory',
  storage: 'Storage', psu: 'Power Supply', case: 'Case', cooling: 'Cooling',
}

const RETAILER_COLORS: Record<RetailerName, string> = {
  amazon: '#ff9900', bestbuy: '#0046be', walmart: '#007dc6', newegg: '#e2231a',
}

const RETAILER_LABELS: Record<RetailerName, string> = {
  amazon: 'Amazon', bestbuy: 'Best Buy', walmart: 'Walmart', newegg: 'Newegg',
}

type ColorFilter = 'lowest' | 'black' | 'white'

interface Props {
  parts: PricedPart[]
  colorFilter: ColorFilter
}

function getDisplayData(part: PricedPart, filter: ColorFilter): {
  price: number; retailer: RetailerName; url: string; fallback: boolean
} {
  if (filter === 'black' && part.blackPrice && part.blackAffiliateUrl && part.blackRetailer) {
    return { price: part.blackPrice, retailer: part.blackRetailer as RetailerName, url: part.blackAffiliateUrl, fallback: false }
  }
  if (filter === 'white' && part.whitePrice && part.whiteAffiliateUrl && part.whiteRetailer) {
    return { price: part.whitePrice, retailer: part.whiteRetailer as RetailerName, url: part.whiteAffiliateUrl, fallback: false }
  }
  return { price: part.lowestPrice, retailer: part.lowestRetailer as RetailerName, url: part.lowestAffiliateUrl, fallback: filter !== 'lowest' }
}

export default function PartsTable({ parts, colorFilter }: Props) {
  const total = parts.reduce((sum, part) => {
    const { price } = getDisplayData(part, colorFilter)
    return sum + price
  }, 0)

  return (
    <div className="w-full">
      <div className="grid grid-cols-[120px_1fr_100px_120px] gap-3 px-3 py-2 text-[10px] text-[#4b5563] uppercase tracking-[0.8px] mb-1">
        <span>Type</span><span>Component</span><span>Retailer</span><span className="text-right">Best Price</span>
      </div>
      <div className="flex flex-col gap-0.5">
        {parts.map((part, i) => {
          const { price, retailer, url, fallback } = getDisplayData(part, colorFilter)
          return (
            <div key={i} className="grid grid-cols-[120px_1fr_100px_120px] gap-3 bg-[#141420] hover:bg-[#1a1a2e] rounded-lg px-3 py-3 items-center transition-colors">
              <span className="text-[11px] text-[#6b7280] font-medium">{PART_LABELS[part.type]}</span>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[#e5e7eb] font-medium">{part.name}</span>
                {fallback && (
                  <span className="text-[10px] bg-[#1e1e2e] text-[#6b7280] rounded px-1.5 py-0.5">
                    {colorFilter === 'white' ? 'White only' : 'Black only'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-sm inline-block" style={{ background: RETAILER_COLORS[retailer] }} />
                <span className="text-[11px] text-[#9ca3af]">{RETAILER_LABELS[retailer]}</span>
              </div>
              <div className="text-right">
                {price > 0 ? (
                  <a href={url} target="_blank" rel="noopener noreferrer sponsored"
                    className="text-[14px] font-bold text-[#818cf8] hover:text-[#6366f1] transition-colors">
                    ${price.toFixed(2)} →
                  </a>
                ) : (
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    className="text-[12px] text-[#6b7280] hover:text-[#9ca3af]">
                    Search →
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-[120px_1fr_100px_120px] gap-3 px-3 py-3.5 mt-2 border-t border-[#1e1e2e] items-center">
        <span />
        <span className="text-[13px] text-[#9ca3af]">Total (lowest prices)</span>
        <span />
        <span className="text-right text-[18px] font-bold text-[#4ade80]">${total.toFixed(2)}</span>
      </div>
      <p className="text-[10px] text-[#374151] mt-2 px-3">
        Links are affiliate links — we may earn a commission at no extra cost to you.{' '}
        <a href="/affiliate-disclosure" className="underline hover:text-[#6b7280]">Learn more</a>
      </p>
    </div>
  )
}
