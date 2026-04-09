import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import type { ExtractedPart, PartType } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a PC hardware expert. The user will give you an image of a prebuilt PC product — either a store shelf photo, product box, spec sheet, or screenshot from a retailer website.

Extract the following information as JSON:
{
  "productName": "full product name if visible, else null",
  "price": price as a number if visible, else null,
  "parts": [
    { "type": "cpu|gpu|memory|storage|motherboard|psu|case|cooling", "name": "clean component name" }
  ]
}

Rules for part names:
- CPU: "Intel Core i7-14700F" or "AMD Ryzen 7 7700X" (brand + model, no marketing fluff)
- GPU: "NVIDIA GeForce RTX 4060 8GB" or "AMD Radeon RX 7600 8GB"
- Memory: "32GB DDR5 5600MHz"
- Storage: "1TB NVMe SSD" or "2TB SATA SSD"
- Motherboard: "Intel B760 ATX motherboard LGA1700" (use chipset code if visible)
- PSU: "650W modular power supply" (wattage + form factor if known)
- Case: brand + model if visible, e.g. "iBUYPOWER Slate case"
- Cooling: "240mm AIO liquid cooler" or "CPU air cooler"

Only include parts you can confidently identify. Return valid JSON only.`

export interface ImageAnalysisResult {
  productName: string | null
  price: number | null
  parts: ExtractedPart[]
}

export async function analyzeImageForParts(
  imageData: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
): Promise<ImageAnalysisResult> {
  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageData },
          },
          {
            type: 'text',
            text: 'Extract the PC specs from this image as JSON.',
          },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  // Parse JSON from response (handle markdown code blocks too)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/)
  const raw = jsonMatch ? jsonMatch[1] ?? jsonMatch[0] : text

  let parsed: { productName?: string | null; price?: number | null; parts?: { type: string; name: string }[] }
  try {
    parsed = JSON.parse(raw.trim())
  } catch {
    // Couldn't parse — return empty
    return { productName: null, price: null, parts: [] }
  }

  const VALID_TYPES = new Set<PartType>(['cpu', 'gpu', 'memory', 'storage', 'motherboard', 'psu', 'case', 'cooling'])

  const parts: ExtractedPart[] = (parsed.parts ?? [])
    .filter(p => p.name && VALID_TYPES.has(p.type as PartType))
    .map(p => ({ type: p.type as PartType, name: p.name.trim() }))

  return {
    productName: parsed.productName ?? null,
    price: typeof parsed.price === 'number' ? parsed.price : null,
    parts,
  }
}
