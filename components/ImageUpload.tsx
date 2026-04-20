'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export default function ImageUpload() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif'

  function handleFileSelect(selected: File) {
    if (!selected.type.startsWith('image/')) {
      setError('Please select a JPEG, PNG, WebP, or GIF image.')
      return
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError('Image must be under 10 MB.')
      return
    }
    setError(null)
    setFile(selected)
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(selected)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFileSelect(f)
  }, [])

  async function handleAnalyze() {
    if (!file) return
    setLoading(true)
    setError(null)

    const form = new FormData()
    form.append('image', file)

    try {
      const res = await fetch('/api/analyze-image', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Analysis failed. Please try a clearer image.')
        return
      }
      router.push(`/confirm/${data.pendingId}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Drop zone */}
      <div
        onClick={() => !preview && fileInputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        className={`
          relative rounded-xl border-2 border-dashed transition-all cursor-pointer
          ${dragging ? 'border-[#6366f1] bg-[#6366f1]/10' : 'border-[#2d2d4a] bg-[#141420] hover:border-[#4b4b7a]'}
          ${preview ? 'p-0 overflow-hidden' : 'p-8'}
        `}
      >
        {preview ? (
          /* Preview */
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Preview" className="w-full max-h-64 object-contain rounded-xl" />
            <button
              onClick={e => { e.stopPropagation(); setPreview(null); setFile(null) }}
              className="absolute top-2 right-2 bg-[#0f0f13]/80 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-[#0f0f13] transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center gap-3 text-center select-none">
            <div className="w-12 h-12 rounded-full bg-[#1e1e2e] flex items-center justify-center text-2xl">📷</div>
            <div>
              <p className="text-[14px] font-medium text-[#e5e7eb]">Drop a photo or screenshot here</p>
              <p className="text-[12px] text-[#6b7280] mt-0.5">Shelf tags, product boxes, spec sheets — we'll read the parts</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
                className="bg-[#1e1e2e] hover:bg-[#2d2d4a] text-[#9ca3af] rounded-lg px-3.5 py-1.5 text-[12px] font-medium border border-[#2d2d4a] transition-colors"
              >
                Browse files
              </button>
              {/* Camera capture on mobile */}
              <button
                onClick={e => {
                  e.stopPropagation()
                  const input = fileInputRef.current
                  if (input) { input.capture = 'environment'; input.click() }
                }}
                className="bg-[#1e1e2e] hover:bg-[#2d2d4a] text-[#9ca3af] rounded-lg px-3.5 py-1.5 text-[12px] font-medium border border-[#2d2d4a] transition-colors"
              >
                📸 Use camera
              </button>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
      />

      {error && <p className="mt-3 text-sm text-[#ef4444] text-center">{error}</p>}

      {file && (
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="mt-4 w-full bg-[#6366f1] hover:bg-[#4f52d6] disabled:opacity-50 text-white rounded-xl py-3 text-[14px] font-semibold transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analyzing image…
            </span>
          ) : (
            'Analyze specs →'
          )}
        </button>
      )}
    </div>
  )
}
