'use client'

interface Props {
  prebuiltName: string
  retailer: string
  prebuiltPrice: number
  buildTotal: number
  windowsEnabled: boolean
}

const RETAILER_LABELS: Record<string, string> = {
  bestbuy: 'Best Buy', newegg: 'Newegg', amazon: 'Amazon', walmart: 'Walmart',
}

export default function ComparisonHeader({ prebuiltName, retailer, prebuiltPrice, buildTotal, windowsEnabled }: Props) {
  const effectiveBuildTotal = buildTotal + (windowsEnabled ? 130 : 0)
  const savings = prebuiltPrice - effectiveBuildTotal
  const pct = Math.round(Math.abs(savings) / prebuiltPrice * 100)
  const cheaper = savings > 0

  return (
    <div className="mb-6">
      <p className="text-[11px] text-[#6b7280] uppercase tracking-[1px] mb-1.5">{RETAILER_LABELS[retailer] ?? retailer} · Prebuilt</p>
      <h1 className="text-[20px] font-bold text-[#f9fafb] tracking-tight mb-4">{prebuiltName}</h1>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="bg-[#1e1e2e] rounded-xl px-5 py-2.5">
          <p className="text-[10px] text-[#6b7280] uppercase tracking-[0.8px]">Prebuilt price</p>
          <p className="text-[22px] font-bold text-[#f9fafb] mt-0.5">${prebuiltPrice.toFixed(2)}</p>
        </div>
        <span className="text-[20px] text-[#374151]">vs</span>
        <div className={`rounded-xl px-5 py-2.5 border ${cheaper ? 'bg-[#052e16] border-[#166534]' : 'bg-[#2d0a0a] border-[#7f1d1d]'}`}>
          <p className={`text-[10px] uppercase tracking-[0.8px] ${cheaper ? 'text-[#4ade80]' : 'text-[#ef4444]'}`}>Build it yourself</p>
          <p className={`text-[22px] font-bold mt-0.5 ${cheaper ? 'text-[#4ade80]' : 'text-[#ef4444]'}`}>${effectiveBuildTotal.toFixed(2)}</p>
        </div>
        <div className={`rounded-xl px-4 py-2 font-bold text-[13px] ${cheaper ? 'bg-[#4ade80] text-[#052e16]' : 'bg-[#ef4444] text-white'}`}>
          {cheaper ? `Save $${savings.toFixed(0)} (${pct}%)` : `Prebuilt saves $${Math.abs(savings).toFixed(0)} (${pct}%)`}
        </div>
      </div>
    </div>
  )
}
