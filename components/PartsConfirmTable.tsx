'use client'

import { useState } from 'react'
import type { ExtractedPart, PartType } from '@/types'

const PART_LABELS: Record<PartType, string> = {
  cpu: 'CPU', gpu: 'GPU', motherboard: 'Motherboard', memory: 'Memory',
  storage: 'Storage', psu: 'Power Supply', case: 'Case', cooling: 'Cooling',
}

interface Props {
  parts: ExtractedPart[]
  pendingId: string
  onConfirm: (parts: ExtractedPart[]) => void
  loading: boolean
}

export default function PartsConfirmTable({ parts, pendingId, onConfirm, loading }: Props) {
  const [editedParts, setEditedParts] = useState<ExtractedPart[]>(parts)

  function updateName(index: number, name: string) {
    setEditedParts(prev => prev.map((p, i) => i === index ? { ...p, name } : p))
  }

  const confirmed = editedParts.filter(p => !p.suggested)
  const suggested = editedParts.filter(p => p.suggested)

  return (
    <div className="w-full">
      {/* Confirmed parts */}
      <div className="grid grid-cols-[120px_1fr] gap-3 px-3 py-2 text-[10px] text-[#4b5563] uppercase tracking-[0.8px] mb-1">
        <span>Type</span><span>Component (edit if needed)</span>
      </div>
      <div className="flex flex-col gap-0.5">
        {editedParts.filter(p => !p.suggested).map((part) => {
          const i = editedParts.indexOf(part)
          return (
            <div key={i} className="grid grid-cols-[120px_1fr] gap-3 bg-[#141420] hover:bg-[#1a1a2e] rounded-lg px-3 py-3 items-center transition-colors">
              <span className="text-[11px] text-[#6b7280] font-medium">{PART_LABELS[part.type]}</span>
              <input
                value={part.name}
                onChange={e => updateName(i, e.target.value)}
                className="bg-transparent text-[13px] text-[#e5e7eb] outline-none border-b border-transparent hover:border-[#2d2d4a] focus:border-[#6366f1] transition-colors w-full"
              />
            </div>
          )
        })}
      </div>

      {/* Suggested parts */}
      {suggested.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 px-3 py-2 mb-1">
            <span className="text-[10px] text-[#6366f1] uppercase tracking-[0.8px] font-semibold">Suggested</span>
            <span className="text-[10px] text-[#4b5563]">— not listed on the product page, edit to match your build</span>
          </div>
          <div className="flex flex-col gap-0.5">
            {suggested.map((part) => {
              const i = editedParts.indexOf(part)
              return (
                <div key={i} className="grid grid-cols-[120px_1fr] gap-3 bg-[#141420] border border-dashed border-[#2d2d4a] hover:bg-[#1a1a2e] rounded-lg px-3 py-3 items-center transition-colors">
                  <span className="text-[11px] text-[#6b7280] font-medium">{PART_LABELS[part.type]}</span>
                  <input
                    value={part.name}
                    onChange={e => updateName(i, e.target.value)}
                    className="bg-transparent text-[13px] text-[#9ca3af] outline-none border-b border-transparent hover:border-[#2d2d4a] focus:border-[#6366f1] transition-colors w-full"
                    placeholder={`Search term for ${PART_LABELS[part.type]}...`}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          onClick={() => onConfirm(editedParts)}
          disabled={loading}
          className="bg-[#6366f1] hover:bg-[#4f52d6] disabled:opacity-50 text-white rounded-lg px-6 py-2.5 text-sm font-semibold transition-colors"
        >
          {loading ? 'Building comparison…' : 'Looks good, build comparison →'}
        </button>
      </div>
    </div>
  )
}
