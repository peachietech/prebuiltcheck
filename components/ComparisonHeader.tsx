'use client'

interface Props {
  prebuiltName: string
  retailer: string
  prebuiltPrice: number
  prebuiltImageUrl: string | null
  affiliatePrebuiltUrl: string | null
  buildTotal: number
  windowsEnabled: boolean
  hasMissingParts: boolean
}

const RETAILER_LABELS: Record<string, string> = {
  bestbuy: 'Best Buy',
  newegg: 'Newegg',
  amazon: 'Amazon',
  walmart: 'Walmart',
  ibuypower: 'iBUYPOWER',
  cyberpowerpc: 'CyberPowerPC',
  costco: 'Costco',
  nzxt: 'NZXT',
  hp: 'HP',
  photo: 'Photo',
}

export default function ComparisonHeader({
  prebuiltName, retailer, prebuiltPrice, prebuiltImageUrl, affiliatePrebuiltUrl,
  buildTotal, windowsEnabled, hasMissingParts,
}: Props) {
  const effectiveBuildTotal = buildTotal + (windowsEnabled ? 130 : 0)
  const savings = prebuiltPrice - effectiveBuildTotal
  const cheaper = savings > 0
  const pct = Math.round(Math.abs(savings) / prebuiltPrice * 100)

  // When parts are missing the DIY total is artificially low — we can only
  // say "saves at least X" when cheaper, and can't trust the comparison otherwise.
  const canTrustComparison = !hasMissingParts

  return (
    <div className="mb-6">
      {/* Incomplete data banner — shown prominently above everything else */}
      {hasMissingParts && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#92400e] bg-[#2d1a00] px-4 py-3">
          <span className="text-[#f59e0b] text-[15px] shrink-0">⚠</span>
          <div>
            <p className="text-[13px] font-semibold text-[#f59e0b]">Build estimate is incomplete</p>
            <p className="text-[12px] text-[#d97706] mt-0.5">
              Some parts couldn&apos;t be priced automatically. The &ldquo;Build it yourself&rdquo; total below is a
              partial estimate — use the search fields in the table to fill in missing prices before comparing.
            </p>
          </div>
        </div>
      )}

      <p className="text-[11px] text-[#6b7280] uppercase tracking-[1px] mb-1.5">
        {RETAILER_LABELS[retailer] ?? retailer} · Prebuilt
      </p>

      {/* Product image + name row */}
      <div className="flex items-start gap-4 mb-4">
        {prebuiltImageUrl && (
          <div className="shrink-0 w-20 h-20 rounded-lg bg-[#1e1e2e] border border-[#2d2d4a] overflow-hidden flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={prebuiltImageUrl}
              alt={prebuiltName}
              className="w-full h-full object-contain p-1"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-[18px] font-bold text-[#f9fafb] tracking-tight leading-snug">{prebuiltName}</h1>
          {affiliatePrebuiltUrl && (
            <a
              href={affiliatePrebuiltUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="inline-flex items-center gap-1 mt-1.5 text-[12px] text-[#818cf8] hover:text-[#6366f1] transition-colors"
            >
              View on {RETAILER_LABELS[retailer] ?? retailer} →
            </a>
          )}
        </div>
      </div>

      {/* Price comparison */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="bg-[#1e1e2e] rounded-xl px-5 py-2.5">
          <p className="text-[10px] text-[#6b7280] uppercase tracking-[0.8px]">Prebuilt price</p>
          <p className="text-[22px] font-bold text-[#f9fafb] mt-0.5">${prebuiltPrice.toFixed(2)}</p>
        </div>

        <span className="text-[20px] text-[#374151]">vs</span>

        {/* DIY box — amber styling when estimate is incomplete */}
        <div className={`rounded-xl px-5 py-2.5 border ${
          hasMissingParts
            ? 'bg-[#2d1a00] border-[#92400e]'
            : cheaper
              ? 'bg-[#052e16] border-[#166534]'
              : 'bg-[#2d0a0a] border-[#7f1d1d]'
        }`}>
          <p className={`text-[10px] uppercase tracking-[0.8px] flex items-center gap-1.5 ${hasMissingParts ? 'text-[#d97706]' : cheaper ? 'text-[#4ade80]' : 'text-[#ef4444]'}`}>
            Build it yourself
            {hasMissingParts && <span className="text-[9px] font-bold bg-[#92400e] text-[#fbbf24] rounded px-1 py-0.5">PARTIAL</span>}
          </p>
          <p className={`text-[22px] font-bold mt-0.5 ${hasMissingParts ? 'text-[#f59e0b]' : cheaper ? 'text-[#4ade80]' : 'text-[#ef4444]'}`}>
            {hasMissingParts ? '≥ ' : ''}${effectiveBuildTotal.toFixed(2)}
          </p>
        </div>

        {/* Savings badge */}
        {canTrustComparison ? (
          <div className={`rounded-xl px-4 py-2 font-bold text-[13px] ${cheaper ? 'bg-[#4ade80] text-[#052e16]' : 'bg-[#ef4444] text-white'}`}>
            {cheaper
              ? `Save $${savings.toFixed(0)} (${pct}%)`
              : `Prebuilt saves $${Math.abs(savings).toFixed(0)} (${pct}%)`}
          </div>
        ) : cheaper ? (
          <div className="rounded-xl px-4 py-2 font-bold text-[13px] bg-[#4ade80] text-[#052e16]">
            Saves at least ${savings.toFixed(0)}
          </div>
        ) : (
          <div className="rounded-xl px-4 py-2 font-bold text-[13px] bg-[#92400e] text-[#fbbf24]">
            Fill in missing parts to compare
          </div>
        )}
      </div>
    </div>
  )
}
