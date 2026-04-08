'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PartsConfirmTable from '@/components/PartsConfirmTable'
import type { ExtractedPart } from '@/types'

export default function ConfirmClient({ pendingId, parts }: { pendingId: string; parts: ExtractedPart[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm(confirmedParts: ExtractedPart[]) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingId, confirmedParts }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      router.push(`/c/${data.slug}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PartsConfirmTable parts={parts} pendingId={pendingId} onConfirm={handleConfirm} loading={loading} />
      {error && <p className="mt-4 text-sm text-[#ef4444]">{error}</p>}
    </>
  )
}
