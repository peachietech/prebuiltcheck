import UrlInput from '@/components/UrlInput'

export default function HomePage() {
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
        <p className="text-sm text-[#6b7280] mb-8">Paste any prebuilt PC link &mdash; we&apos;ll find every part at its lowest price.</p>
        <UrlInput />
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
