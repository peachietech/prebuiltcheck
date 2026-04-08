'use client'

interface Props {
  enabled: boolean
  onChange: (enabled: boolean) => void
}

export const WINDOWS_COST = 130

export default function WindowsToggle({ enabled, onChange }: Props) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`flex items-center gap-2 text-[12px] rounded-lg px-3 py-2 border transition-colors ${
        enabled
          ? 'border-[#6366f1] text-[#818cf8] bg-[#1a1a2e]'
          : 'border-[#2d2d4a] text-[#6b7280] hover:border-[#374151]'
      }`}
    >
      <span className={`w-3 h-3 rounded border flex-shrink-0 transition-colors ${enabled ? 'bg-[#6366f1] border-[#6366f1]' : 'border-[#4b5563]'}`} />
      + $130 Windows 11 Home
    </button>
  )
}
