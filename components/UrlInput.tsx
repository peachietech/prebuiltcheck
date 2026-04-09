'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const SUPPORTED_DOMAINS = [
  'bestbuy.com', 'newegg.com', 'amazon.com', 'walmart.com',
  'ibuypower.com', 'cyberpowerpc.com', 'costco.com', 'nzxt.com', 'hp.com',
]

export default function UrlInput() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSupported = SUPPORTED_DOMAINS.some(d => url.includes(d))

  async function handleCompare() {
    if (!url) return
    if (!isSupported) {
      setError('Unsupported retailer — try Best Buy, Newegg, Amazon, Walmart, iBUYPOWER, CyberPowerPC, Costco, NZXT, or HP')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }

      if (data.redirect) {
        router.push(data.redirect)
      } else {
        router.push(`/confirm/${data.pendingId}`)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex gap-0 bg-[#1a1a2e] rounded-xl border border-[#2d2d4a] p-1.5 pl-4 items-center">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCompare()}
          placeholder="Paste a prebuilt PC link…"
          className="flex-1 bg-transparent outline-none text-sm text-[#e5e7eb] placeholder:text-[#4b5563] min-w-0"
        />
        <button
          onClick={handleCompare}
          disabled={loading || !url}
          className="bg-[#6366f1] hover:bg-[#4f52d6] disabled:opacity-50 text-white rounded-lg px-5 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors"
        >
          {loading ? 'Loading…' : 'Compare →'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-[#ef4444] text-center">{error}</p>}
    </div>
  )
}
