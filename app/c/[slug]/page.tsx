import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'
import ComparisonClient from './ComparisonClient'
import type { PricedPart } from '@/types'

export default async function ComparisonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createServerClient()

  const { data: comparison } = await supabase
    .from('comparisons')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!comparison) notFound()

  const { data: partsRows } = await supabase
    .from('parts')
    .select('*')
    .eq('comparison_id', comparison.id)

  const parts: PricedPart[] = (partsRows ?? []).map(row => ({
    type: row.type,
    name: row.name,
    lowestPrice: row.lowest_price,
    lowestRetailer: row.lowest_retailer,
    lowestAffiliateUrl: row.lowest_affiliate_url,
    blackPrice: row.black_price,
    blackRetailer: row.black_retailer,
    blackAffiliateUrl: row.black_affiliate_url,
    whitePrice: row.white_price,
    whiteRetailer: row.white_retailer,
    whiteAffiliateUrl: row.white_affiliate_url,
  }))

  return (
    <main className="min-h-screen bg-[#0f0f13]">
      <nav className="flex items-center gap-3 px-6 py-4 border-b border-[#1e1e2e]">
        <a href="/" className="text-[15px] font-bold tracking-tight text-white">PrebuiltCheck</a>
        <span className="flex-1" />
        <span className="text-xs text-[#6b7280]">Sign in</span>
      </nav>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <ComparisonClient
          prebuiltName={comparison.prebuilt_name}
          retailer={comparison.retailer}
          prebuiltPrice={comparison.prebuilt_price}
          slug={comparison.slug}
          parts={parts}
        />
      </div>
    </main>
  )
}
