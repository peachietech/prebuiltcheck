'use client'

type ColorFilter = 'lowest' | 'black' | 'white'

interface Props {
  value: ColorFilter
  onChange: (value: ColorFilter) => void
}

export default function ColorToggle({ value, onChange }: Props) {
  const options: { key: ColorFilter; label: string; dot?: string }[] = [
    { key: 'lowest', label: 'Lowest' },
    { key: 'black', label: 'Black', dot: '#111' },
    { key: 'white', label: 'White', dot: '#f0f0f0' },
  ]

  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] text-[#6b7280] font-medium">Filter parts by color:</span>
      <div className="flex bg-[#1a1a2e] rounded-lg p-0.5 gap-0.5">
        {options.map(opt => (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-[5px] text-[12px] transition-colors ${
              value === opt.key
                ? 'bg-[#6366f1] text-white font-semibold'
                : 'text-[#6b7280] hover:text-[#9ca3af]'
            }`}
          >
            {opt.dot && (
              <span className="w-2.5 h-2.5 rounded-full border border-[#555] inline-block flex-shrink-0"
                style={{ background: opt.dot }} />
            )}
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
