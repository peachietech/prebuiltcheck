import type { ExtractedPart, PartType } from '@/types'

// Strips marketing copy from feature text, leaving just the searchable component name.
// Best Buy features look like: "Intel Core i7 14700F\nNative 20-core processing delivers..."
// We want:                      "Intel Core i7-14700F"
export function cleanPartName(text: string, type: PartType): string {
  // Take only the first line — everything after \n is marketing description
  const firstLine = text.split('\n')[0].trim()

  switch (type) {
    case 'cpu': {
      // Matches: "Intel Core i7 14700F", "Intel Core i9-14900K", "AMD Ryzen 9 7950X"
      const m = firstLine.match(/Intel Core\s+\w[\w-]*(?:\s+\d+\w+)?|AMD Ryzen\s+\d+\s+\d+\w*/i)
      if (m) return m[0].replace(/\s+/g, ' ').trim()
      break
    }
    case 'gpu': {
      // Match full brand + model + VRAM, e.g. "NVIDIA GeForce RTX 4060 8GB"
      const m = firstLine.match(
        /(?:NVIDIA GeForce\s+|AMD Radeon\s+)?(?:RTX|GTX|RX)\s+\d{4}(?:\s+Ti)?(?:\s+\d+GB)?/i
      )
      if (m) return m[0].replace(/\s+/g, ' ').trim()
      break
    }
    case 'memory': {
      // "32GB of DDR5 RGB 5200MHz memory" → "32GB DDR5 5200MHz"
      const m = firstLine.match(/\d+GB\s+(?:of\s+)?(?:\w+\s+)?DDR[45](?:\s+\w+)?\s*(\d{4}MHz)?/i)
      if (m) {
        return m[0]
          .replace(/\bof\b/i, '')
          .replace(/\bRGB\b/i, '')
          .replace(/\s+/g, ' ')
          .trim()
      }
      break
    }
    case 'storage': {
      // "1TB NVMe solid state drive" → "1TB NVMe SSD"
      const m = firstLine.match(/\d+(?:TB|GB)\s+(?:NVMe|SATA)?\s*(?:solid state drive|SSD|HDD)?/i)
      if (m) return m[0].replace(/solid state drive/i, 'SSD').replace(/\s+/g, ' ').trim()
      break
    }
    case 'motherboard': {
      const m = firstLine.match(/\w+\s+\w+\s+(?:Z\d+|B\d+|X\d+|A\d+)\w*(?:\s+(?:ATX|mATX|ITX))?/i)
      if (m) return m[0].replace(/\s+/g, ' ').trim()
      break
    }
    case 'psu': {
      const m = firstLine.match(/\d+\s*W(?:att)?\b/i)
      if (m) return `${m[0].trim()} power supply`
      break
    }
    case 'case': {
      const m = firstLine.match(/.*?(?:mid|full|mini)[\s-]tower/i)
      if (m) return m[0].replace(/\s+/g, ' ').trim()
      // Just take whatever was before "case"
      const c = firstLine.split(/\bcase\b/i)[0].trim()
      return c ? `${c} case` : firstLine.slice(0, 60)
    }
    case 'cooling': {
      const m = firstLine.match(/\d+mm\s+(?:AIO|liquid)/i)
      if (m) return `${m[0]} cooler`
      break
    }
  }

  // Fallback: first 80 chars of first line, trimmed
  return firstLine.slice(0, 80).trim()
}

// When a listing doesn't mention PSU / case / cooling / motherboard, suggest
// sensible generic alternatives based on the CPU and GPU detected.
export function suggestMissingParts(parts: ExtractedPart[]): ExtractedPart[] {
  const found = new Set(parts.map(p => p.type))
  const suggestions: ExtractedPart[] = []

  const cpuName = parts.find(p => p.type === 'cpu')?.name ?? ''
  const gpuName = parts.find(p => p.type === 'gpu')?.name ?? ''

  if (!found.has('motherboard')) {
    let mobo = 'ATX gaming motherboard'
    if (/i\d+-1[456]\d{3}/i.test(cpuName) || /14\d{3}[KF]/i.test(cpuName)) {
      mobo = 'Intel Z790 ATX motherboard LGA1700'
    } else if (/i\d+-1[23]\d{3}/i.test(cpuName)) {
      mobo = 'Intel Z690 ATX motherboard LGA1700'
    } else if (/ryzen\s+[579]\s+7\d{3}/i.test(cpuName)) {
      mobo = 'AMD B650 ATX motherboard AM5'
    } else if (/ryzen\s+[579]\s+5\d{3}/i.test(cpuName)) {
      mobo = 'AMD B550 ATX motherboard AM4'
    }
    suggestions.push({ type: 'motherboard', name: mobo, suggested: true })
  }

  if (!found.has('psu')) {
    let watts = '650W'
    if (/RTX\s+40[89]\d|RTX\s+30[89]\d/i.test(gpuName)) watts = '850W'
    else if (/RTX\s+407\d|RTX\s+406\d|RTX\s+307\d/i.test(gpuName)) watts = '750W'
    suggestions.push({ type: 'psu', name: `${watts} modular power supply`, suggested: true })
  }

  if (!found.has('case')) {
    suggestions.push({ type: 'case', name: 'ATX mid tower PC case', suggested: true })
  }

  if (!found.has('cooling')) {
    let cooler = '120mm AIO liquid cooler'
    if (/i9|ryzen\s+9/i.test(cpuName)) cooler = '240mm AIO liquid cooler'
    else if (/i7|ryzen\s+7/i.test(cpuName)) cooler = '240mm AIO liquid cooler'
    suggestions.push({ type: 'cooling', name: cooler, suggested: true })
  }

  return suggestions
}
