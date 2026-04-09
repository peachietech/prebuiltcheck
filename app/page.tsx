'use client'

import { useState } from 'react'
import UrlInput from '@/components/UrlInput'
import ImageUpload from '@/components/ImageUpload'

type Tab = 'url' | 'photo'

const RETAILERS = [
  'Best Buy', 'Newegg', 'Amazon', 'Walmart',
  'iBUYPOWER', 'CyberPowerPC', 'Costco', 'NZXT', 'HP',
]

export default function HomePage() {
  const [tab, setTab] = useState<Tab>('url')

  return (
    <main className="min-h-screen bg-[#0f0f13]">
      {/* Nav */}
      <nav className="flex items-center gap-3 px-7 py-4 border-b border-[#1a1a2e]">
        <span className="text-[15px] font-bold tracking-tight">PrebuiltCheck</span>
        <span className="flex-1" />
        <span className="text-xs text-[#6b7280] cursor-pointer hover:text-white transition-colors">Saved builds</span>
        <button className="bg-[#6366f1] text-white text-xs font-medium rounded-lg px-3.5 py-1.5">Sign in</button>
      </nav>

      {/* Hero */}
      <section className="text-center px-7 pt-14 pb-12">
        <p className="text-[11px] text-[#6366f1] uppercase tracking-[2px] font-semibold mb-3.5">Stop overpaying for prebuilts</p>
        <h1 className="text-[32px] font-extrabold tracking-tight leading-tight text-[#f9fafb] mb-3">
          See exactly how much you could save<br />by building it yourself
        </h1>
        <p className="text-sm text-[#6b7280] mb-8">
          Paste a prebuilt PC link or upload a photo — we&apos;ll find every part at its lowest price.
        </p>

        {/* Tab switcher */}
        <div className="inline-flex bg-[#1a1a2e] rounded-xl p-1 mb-6 border border-[#2d2d4a]">
          <button
            onClick={() => setTab('url')}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
              tab === 'url'
                ? 'bg-[#6366f1] text-white'
                : 'text-[#6b7280] hover:text-[#9ca3af]'
            }`}
          >
            🔗 Paste URL
          </button>
          <button
            onClick={() => setTab('photo')}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
              tab === 'photo'
                ? 'bg-[#6366f1] text-white'
                : 'text-[#6b7280] hover:text-[#9ca3af]'
            }`}
          >
            📷 Upload Photo
          </button>
        </div>

        {tab === 'url' ? (
          <>
            <UrlInput />
            <p className="mt-2.5 text-xs text-[#374151]">
              {RETAILERS.join(' · ')}
            </p>
          </>
        ) : (
          <>
            <ImageUpload />
            <p className="mt-3 text-xs text-[#374151]">
              Works with store shelf tags, product boxes, and spec sheet screenshots
            </p>
          </>
        )}
      </section>

      {/* Featured Deals — placeholder until comparisons exist */}
      <section className="px-7 pb-12">
        <div className="flex items-baseline gap-2.5 mb-4">
          <h2 className="text-[15px] font-bold">Featured Deals</h2>
          <span className="text-xs text-[#4b5563]">Best savings this week</span>
          <span className="ml-auto text-xs text-[#6366f1] cursor-pointer">View all &rarr;</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#141420] rounded-xl border border-[#2d2d4a] h-48 animate-pulse" />
          ))}
        </div>
      </section>
    </main>
  )
}
