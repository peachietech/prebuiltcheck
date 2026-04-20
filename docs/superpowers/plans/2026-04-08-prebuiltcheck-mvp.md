# PrebuiltCheck MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core PrebuiltCheck tool — user pastes a prebuilt PC URL, the site scrapes and extracts parts, user confirms, site queries retailer APIs for lowest prices, and renders a shareable comparison page with affiliate links.

**Architecture:** Next.js 16 App Router on Vercel with API routes handling scraping (ScrapingBee), retailer price lookups (Amazon PA API, Best Buy API, Walmart API), and comparison data stored in Supabase PostgreSQL. Color filter and Windows license toggle are client-side state. Newegg added in Plan 2 (datafeed import). Share links use 8-character random slugs with 30-day TTL.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS v4 (CSS-first config, no tailwind.config.ts), Supabase (`@supabase/supabase-js`), ScrapingBee REST API, Amazon PA API 5.0 (`paapi5-nodejs-sdk`), Best Buy Products API, Walmart Open API, Vitest, React Testing Library, `nanoid`

---

## File Map

```
prebuilt-site/
├── app/
│   ├── layout.tsx                      # Root layout, global styles
│   ├── page.tsx                        # Homepage — URL input + featured deals skeleton
│   ├── confirm/[id]/
│   │   └── page.tsx                    # Parts confirmation page (server component, loads pending comparison)
│   ├── c/[slug]/
│   │   └── page.tsx                    # Comparison page (server component, loads comparison + parts)
│   └── api/
│       ├── scrape/route.ts             # POST /api/scrape — ScrapingBee + parser + store pending
│       └── compare/route.ts            # POST /api/compare — retailer lookups + store final comparison
├── components/
│   ├── UrlInput.tsx                    # URL paste input + submit button (client component)
│   ├── PartsConfirmTable.tsx           # Editable parts list before comparison (client component)
│   ├── ComparisonHeader.tsx            # Prebuilt vs build summary + savings badge (client component)
│   ├── ColorToggle.tsx                 # Lowest / Black / White toggle (client component)
│   ├── WindowsToggle.tsx               # +$130 Windows license toggle (client component)
│   └── PartsTable.tsx                  # Parts list rows with affiliate links (client component)
├── lib/
│   ├── supabase.ts                     # Supabase server client factory
│   ├── slug.ts                         # 8-char random slug generator
│   ├── scraping/
│   │   ├── scrapingbee.ts              # ScrapingBee API client (fetch HTML for URL)
│   │   ├── dedup.ts                    # Check if URL was scraped in last 24h → return cached slug
│   │   └── parsers/
│   │       ├── index.ts                # Detect retailer from URL → call correct parser
│   │       ├── bestbuy.ts              # Extract parts from Best Buy HTML
│   │       ├── newegg.ts               # Extract parts from Newegg HTML
│   │       ├── amazon.ts               # Extract parts from Amazon HTML
│   │       └── walmart.ts              # Extract parts from Walmart HTML
│   └── retailers/
│       ├── amazon.ts                   # Amazon PA API search (keyword → price + affiliate URL)
│       ├── bestbuy.ts                  # Best Buy Products API search
│       ├── walmart.ts                  # Walmart Open API search
│       └── pricing.ts                  # Select lowest price across retailers + color variants
├── types/
│   └── index.ts                        # Shared TypeScript types
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql      # comparisons + pending_comparisons + parts tables
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.ts`, `.env.local.example` (Note: Tailwind v4 has no `tailwind.config.ts` — config lives in `app/globals.css`)

- [ ] **Step 1: Bootstrap Next.js project**

```bash
cd "C:/Users/peachie/OneDrive/Documents/prebuilt site"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir no --import-alias "@/*"
```

Expected: Next.js 16 project created with TypeScript, Tailwind v4, App Router.

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js nanoid paapi5-nodejs-sdk
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

Create `vitest.setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 5: Create .env.local.example**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# ScrapingBee
SCRAPINGBEE_API_KEY=

# Amazon PA API
AMAZON_ACCESS_KEY=
AMAZON_SECRET_KEY=
AMAZON_ASSOCIATE_TAG=
AMAZON_PARTNER_TAG=

# Best Buy
BESTBUY_API_KEY=
BESTBUY_AFFILIATE_TAG=

# Walmart
WALMART_CLIENT_ID=
WALMART_CLIENT_SECRET=
WALMART_AFFILIATE_IMPACT_ID=
```

Copy to `.env.local` and fill in real values before running.

- [ ] **Step 6: Verify dev server starts**

```bash
npm run dev
```

Expected: Server running at http://localhost:3000 with default Next.js page.

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js 14 project with Tailwind, Vitest"
```

---

## Task 2: Supabase Setup + Database Migration

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `lib/supabase.ts`

- [ ] **Step 1: Create a Supabase project**

Go to supabase.com → New project. Copy the project URL and anon key into `.env.local`.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/001_initial_schema.sql`:
```sql
-- Pending comparisons (before retailer lookup, after scraping)
create table pending_comparisons (
  id uuid primary key default gen_random_uuid(),
  prebuilt_url text not null,
  prebuilt_name text not null,
  prebuilt_price numeric,
  prebuilt_image_url text,
  retailer text not null,
  extracted_parts jsonb not null,
  created_at timestamptz not null default now()
);

-- Final comparisons (after retailer lookup)
create table comparisons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  user_id uuid references auth.users(id),
  prebuilt_url text not null,
  prebuilt_name text not null,
  prebuilt_price numeric not null,
  prebuilt_image_url text,
  retailer text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- Individual parts for each comparison
create table parts (
  id uuid primary key default gen_random_uuid(),
  comparison_id uuid not null references comparisons(id) on delete cascade,
  type text not null check (type in ('cpu','gpu','motherboard','memory','storage','psu','case','cooling')),
  name text not null,
  lowest_price numeric not null,
  lowest_retailer text not null,
  lowest_affiliate_url text not null,
  black_price numeric,
  black_retailer text,
  black_affiliate_url text,
  white_price numeric,
  white_retailer text,
  white_affiliate_url text,
  last_price_updated timestamptz not null default now()
);

create index on parts(comparison_id);
create index on comparisons(slug);
create index on comparisons(prebuilt_url);
```

- [ ] **Step 3: Run the migration in Supabase**

Go to Supabase dashboard → SQL Editor → paste the migration SQL → Run.

Expected: Tables `pending_comparisons`, `comparisons`, `parts` created with no errors.

- [ ] **Step 4: Write Supabase client**

Create `lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

// Server-side client (uses service role key — never expose to browser)
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Browser-safe client (uses anon key)
export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add supabase/ lib/supabase.ts
git commit -m "feat: add Supabase schema migration and client"
```

---

## Task 3: Shared Types

**Files:**
- Create: `types/index.ts`
- Create: `types/index.test.ts`

- [ ] **Step 1: Write the types**

Create `types/index.ts`:
```typescript
export type PartType = 'cpu' | 'gpu' | 'motherboard' | 'memory' | 'storage' | 'psu' | 'case' | 'cooling'

export type RetailerName = 'amazon' | 'bestbuy' | 'walmart' | 'newegg'

export interface ExtractedPart {
  type: PartType
  name: string
}

export interface RetailerListing {
  retailer: RetailerName
  price: number
  affiliateUrl: string
  name: string
}

export interface PricedPart {
  type: PartType
  name: string
  lowestPrice: number
  lowestRetailer: RetailerName
  lowestAffiliateUrl: string
  blackPrice: number | null
  blackRetailer: RetailerName | null
  blackAffiliateUrl: string | null
  whitePrice: number | null
  whiteRetailer: RetailerName | null
  whiteAffiliateUrl: string | null
}

export interface Comparison {
  id: string
  slug: string
  prebuiltUrl: string
  prebuiltName: string
  prebuiltPrice: number
  prebuiltImageUrl: string | null
  retailer: string
  parts: PricedPart[]
  createdAt: string
  expiresAt: string | null
}

export interface PendingComparison {
  id: string
  prebuiltUrl: string
  prebuiltName: string
  prebuiltPrice: number | null
  prebuiltImageUrl: string | null
  retailer: string
  extractedParts: ExtractedPart[]
}
```

- [ ] **Step 2: Write a smoke test**

Create `types/index.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import type { ExtractedPart, PricedPart, PartType } from './index'

describe('types', () => {
  it('ExtractedPart accepts valid part types', () => {
    const validTypes: PartType[] = ['cpu', 'gpu', 'motherboard', 'memory', 'storage', 'psu', 'case', 'cooling']
    const parts: ExtractedPart[] = validTypes.map(type => ({ type, name: 'Test Part' }))
    expect(parts).toHaveLength(8)
  })

  it('PricedPart allows null color fields', () => {
    const part: PricedPart = {
      type: 'cpu',
      name: 'Intel Core i7',
      lowestPrice: 289,
      lowestRetailer: 'amazon',
      lowestAffiliateUrl: 'https://amazon.com/dp/ABC?tag=test',
      blackPrice: null,
      blackRetailer: null,
      blackAffiliateUrl: null,
      whitePrice: null,
      whiteRetailer: null,
      whiteAffiliateUrl: null,
    }
    expect(part.blackPrice).toBeNull()
  })
})
```

- [ ] **Step 3: Run test**

```bash
npm run test:run
```

Expected: 2 tests pass.

- [ ] **Step 4: Commit**

```bash
git add types/
git commit -m "feat: add shared TypeScript types"
```

---

## Task 4: Slug Utility

**Files:**
- Create: `lib/slug.ts`
- Create: `lib/slug.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/slug.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { generateSlug } from './slug'

describe('generateSlug', () => {
  it('returns an 8-character string', () => {
    const slug = generateSlug()
    expect(slug).toHaveLength(8)
  })

  it('returns URL-safe characters only', () => {
    for (let i = 0; i < 50; i++) {
      const slug = generateSlug()
      expect(slug).toMatch(/^[a-zA-Z0-9_-]+$/)
    }
  })

  it('generates unique values', () => {
    const slugs = new Set(Array.from({ length: 100 }, generateSlug))
    expect(slugs.size).toBe(100)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run lib/slug.test.ts
```

Expected: FAIL — `generateSlug` not found.

- [ ] **Step 3: Implement**

Create `lib/slug.ts`:
```typescript
import { customAlphabet } from 'nanoid'

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
export const generateSlug = customAlphabet(alphabet, 8)
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run lib/slug.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/slug.ts lib/slug.test.ts
git commit -m "feat: add slug generation utility"
```

---

## Task 5: ScrapingBee Client + URL Dedup

**Files:**
- Create: `lib/scraping/scrapingbee.ts`
- Create: `lib/scraping/scrapingbee.test.ts`
- Create: `lib/scraping/dedup.ts`
- Create: `lib/scraping/dedup.test.ts`

- [ ] **Step 1: Write ScrapingBee failing tests**

Create `lib/scraping/scrapingbee.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { fetchPageHtml } from './scrapingbee'

vi.stubGlobal('fetch', vi.fn())

describe('fetchPageHtml', () => {
  it('calls ScrapingBee API with correct params', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response('<html>test</html>', { status: 200 }))

    const html = await fetchPageHtml('https://www.bestbuy.com/product/123')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('app.scrapingbee.com/api/v1'),
      expect.any(Object)
    )
    expect(html).toBe('<html>test</html>')
  })

  it('throws on non-200 status', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response('blocked', { status: 429 }))

    await expect(fetchPageHtml('https://www.bestbuy.com/product/123')).rejects.toThrow('ScrapingBee error: 429')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run lib/scraping/scrapingbee.test.ts
```

Expected: FAIL — `fetchPageHtml` not found.

- [ ] **Step 3: Implement ScrapingBee client**

Create `lib/scraping/scrapingbee.ts`:
```typescript
export async function fetchPageHtml(url: string): Promise<string> {
  const params = new URLSearchParams({
    api_key: process.env.SCRAPINGBEE_API_KEY!,
    url,
    render_js: 'true',
    premium_proxy: 'true',
  })

  const response = await fetch(`https://app.scrapingbee.com/api/v1?${params}`)

  if (!response.ok) {
    throw new Error(`ScrapingBee error: ${response.status}`)
  }

  return response.text()
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run lib/scraping/scrapingbee.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Write dedup failing tests**

Create `lib/scraping/dedup.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { findCachedComparison } from './dedup'

const mockSelect = vi.fn()
const mockFrom = vi.fn(() => ({ select: mockSelect }))
vi.mock('@/lib/supabase', () => ({
  createServerClient: () => ({ from: mockFrom }),
}))

describe('findCachedComparison', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns slug when URL was scraped within 24 hours', async () => {
    mockSelect.mockResolvedValueOnce({
      data: [{ slug: 'abc12345', created_at: new Date().toISOString() }],
      error: null,
    })

    const result = await findCachedComparison('https://bestbuy.com/product/123')
    expect(result).toBe('abc12345')
  })

  it('returns null when no recent comparison exists', async () => {
    mockSelect.mockResolvedValueOnce({ data: [], error: null })
    const result = await findCachedComparison('https://bestbuy.com/product/999')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npm run test:run lib/scraping/dedup.test.ts
```

Expected: FAIL — `findCachedComparison` not found.

- [ ] **Step 7: Implement dedup**

Create `lib/scraping/dedup.ts`:
```typescript
import { createServerClient } from '@/lib/supabase'

const CACHE_HOURS = 24

export async function findCachedComparison(url: string): Promise<string | null> {
  const supabase = createServerClient()
  const cutoff = new Date(Date.now() - CACHE_HOURS * 60 * 60 * 1000).toISOString()

  const { data } = await supabase
    .from('comparisons')
    .select('slug, created_at')
    .eq('prebuilt_url', url)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)

  return data && data.length > 0 ? data[0].slug : null
}
```

- [ ] **Step 8: Run all tests**

```bash
npm run test:run
```

Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add lib/scraping/
git commit -m "feat: add ScrapingBee client and URL deduplication"
```

---

## Task 6: Retailer HTML Parsers

**Files:**
- Create: `lib/scraping/parsers/index.ts`
- Create: `lib/scraping/parsers/bestbuy.ts`
- Create: `lib/scraping/parsers/newegg.ts`
- Create: `lib/scraping/parsers/amazon.ts`
- Create: `lib/scraping/parsers/walmart.ts`
- Create: `lib/scraping/parsers/parsers.test.ts`

- [ ] **Step 1: Install HTML parser**

```bash
npm install node-html-parser
```

- [ ] **Step 2: Write failing parser tests**

Create `lib/scraping/parsers/parsers.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { detectRetailer, parsePrebuiltPage } from './index'

describe('detectRetailer', () => {
  it('detects bestbuy', () => expect(detectRetailer('https://www.bestbuy.com/site/product/123')).toBe('bestbuy'))
  it('detects newegg', () => expect(detectRetailer('https://www.newegg.com/product/N82E123')).toBe('newegg'))
  it('detects amazon', () => expect(detectRetailer('https://www.amazon.com/dp/B09XYZ')).toBe('amazon'))
  it('detects walmart', () => expect(detectRetailer('https://www.walmart.com/ip/product/123')).toBe('walmart'))
  it('throws for unsupported retailer', () => {
    expect(() => detectRetailer('https://www.microcenter.com/product/123')).toThrow('Unsupported retailer')
  })
})

describe('parsePrebuiltPage — Best Buy', () => {
  const html = `
    <html><body>
      <h1 class="sku-title">iBUYPOWER Y60 Gaming Desktop</h1>
      <div class="priceView-customer-price"><span>$1,299.99</span></div>
      <img class="primary-image" src="https://cdn.bestbuy.com/image.jpg" />
      <ul class="feature-list">
        <li>Intel Core i7-13700KF Processor</li>
        <li>NVIDIA GeForce RTX 4070 GPU</li>
        <li>32GB DDR5 RAM</li>
        <li>1TB NVMe SSD</li>
        <li>750W Power Supply</li>
        <li>ASUS TUF Z790 Motherboard</li>
        <li>iBUYPOWER Y60 Case</li>
        <li>240mm AIO Liquid Cooler</li>
      </ul>
    </body></html>
  `

  it('extracts prebuilt name', () => {
    const result = parsePrebuiltPage(html, 'https://www.bestbuy.com/site/123', 'bestbuy')
    expect(result.prebuiltName).toBe('iBUYPOWER Y60 Gaming Desktop')
  })

  it('extracts prebuilt price', () => {
    const result = parsePrebuiltPage(html, 'https://www.bestbuy.com/site/123', 'bestbuy')
    expect(result.prebuiltPrice).toBe(1299.99)
  })

  it('extracts CPU part', () => {
    const result = parsePrebuiltPage(html, 'https://www.bestbuy.com/site/123', 'bestbuy')
    const cpu = result.parts.find(p => p.type === 'cpu')
    expect(cpu?.name).toContain('i7-13700KF')
  })

  it('extracts GPU part', () => {
    const result = parsePrebuiltPage(html, 'https://www.bestbuy.com/site/123', 'bestbuy')
    const gpu = result.parts.find(p => p.type === 'gpu')
    expect(gpu?.name).toContain('RTX 4070')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm run test:run lib/scraping/parsers/parsers.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 4: Implement router + Best Buy parser**

Create `lib/scraping/parsers/index.ts`:
```typescript
import type { ExtractedPart } from '@/types'
import { parseBestBuy } from './bestbuy'
import { parseNewegg } from './newegg'
import { parseAmazon } from './amazon'
import { parseWalmart } from './walmart'

export type SupportedRetailer = 'bestbuy' | 'newegg' | 'amazon' | 'walmart'

export interface ParsedListing {
  prebuiltName: string
  prebuiltPrice: number | null
  prebuiltImageUrl: string | null
  retailer: SupportedRetailer
  parts: ExtractedPart[]
}

export function detectRetailer(url: string): SupportedRetailer {
  if (url.includes('bestbuy.com')) return 'bestbuy'
  if (url.includes('newegg.com')) return 'newegg'
  if (url.includes('amazon.com')) return 'amazon'
  if (url.includes('walmart.com')) return 'walmart'
  throw new Error(`Unsupported retailer: ${url}`)
}

export function parsePrebuiltPage(html: string, url: string, retailer: SupportedRetailer): ParsedListing {
  switch (retailer) {
    case 'bestbuy': return parseBestBuy(html, url)
    case 'newegg': return parseNewegg(html, url)
    case 'amazon': return parseAmazon(html, url)
    case 'walmart': return parseWalmart(html, url)
  }
}
```

Create `lib/scraping/parsers/bestbuy.ts`:
```typescript
import { parse } from 'node-html-parser'
import type { ParsedListing } from './index'
import type { ExtractedPart } from '@/types'

const PART_PATTERNS: { type: ExtractedPart['type']; patterns: RegExp[] }[] = [
  { type: 'cpu', patterns: [/intel core/i, /amd ryzen/i, /processor/i] },
  { type: 'gpu', patterns: [/nvidia geforce/i, /rtx \d+/i, /amd radeon/i, /rx \d+/i, /\bgpu\b/i] },
  { type: 'memory', patterns: [/\bddr[45]\b/i, /\bram\b/i, /gb.*memory/i] },
  { type: 'storage', patterns: [/\bnvme\b/i, /\bssd\b/i, /\bhdd\b/i, /tb.*storage/i, /gb.*storage/i] },
  { type: 'motherboard', patterns: [/motherboard/i, /\bmobo\b/i] },
  { type: 'psu', patterns: [/power supply/i, /\bpsu\b/i, /\d+w\b/i] },
  { type: 'case', patterns: [/\bcase\b/i, /mid tower/i, /full tower/i, /atx.*chassis/i] },
  { type: 'cooling', patterns: [/cooler/i, /\baio\b/i, /liquid cool/i, /\bfan\b/i] },
]

function classifyLine(text: string): ExtractedPart['type'] | null {
  for (const { type, patterns } of PART_PATTERNS) {
    if (patterns.some(p => p.test(text))) return type
  }
  return null
}

export function parseBestBuy(html: string, url: string): ParsedListing {
  const root = parse(html)

  const prebuiltName = root.querySelector('.sku-title')?.text.trim() ??
    root.querySelector('h1')?.text.trim() ?? 'Unknown Product'

  const priceText = root.querySelector('.priceView-customer-price span')?.text ?? ''
  const prebuiltPrice = parseFloat(priceText.replace(/[^0-9.]/g, '')) || null

  const prebuiltImageUrl = root.querySelector('.primary-image')?.getAttribute('src') ?? null

  const parts: ExtractedPart[] = []
  const seen = new Set<ExtractedPart['type']>()

  const featureItems = root.querySelectorAll('.feature-list li, .features-list li, ul.bullets li')
  for (const item of featureItems) {
    const text = item.text.trim()
    const type = classifyLine(text)
    if (type && !seen.has(type)) {
      parts.push({ type, name: text })
      seen.add(type)
    }
  }

  return { prebuiltName, prebuiltPrice, prebuiltImageUrl, retailer: 'bestbuy', parts }
}
```

Create `lib/scraping/parsers/newegg.ts`:
```typescript
import { parse } from 'node-html-parser'
import type { ParsedListing } from './index'
import type { ExtractedPart } from '@/types'

const SPEC_LABEL_MAP: Record<string, ExtractedPart['type']> = {
  'cpu': 'cpu', 'processor': 'cpu',
  'gpu': 'gpu', 'graphics': 'gpu', 'video card': 'gpu',
  'memory': 'memory', 'ram': 'memory',
  'storage': 'storage', 'hard drive': 'storage', 'ssd': 'storage',
  'motherboard': 'motherboard',
  'power supply': 'psu', 'psu': 'psu',
  'case': 'case', 'chassis': 'case',
  'cooling': 'cooling', 'cooler': 'cooling',
}

export function parseNewegg(html: string, url: string): ParsedListing {
  const root = parse(html)

  const prebuiltName = root.querySelector('.product-title')?.text.trim() ??
    root.querySelector('h1')?.text.trim() ?? 'Unknown Product'

  const priceText = root.querySelector('.price-current')?.text ?? ''
  const prebuiltPrice = parseFloat(priceText.replace(/[^0-9.]/g, '')) || null

  const prebuiltImageUrl = root.querySelector('.product-view-img-original')?.getAttribute('src') ?? null

  const parts: ExtractedPart[] = []
  const seen = new Set<ExtractedPart['type']>()

  // Newegg specs are in a table with th (label) + td (value) pairs
  const rows = root.querySelectorAll('.product-specs tr, .specifications tr')
  for (const row of rows) {
    const label = row.querySelector('th')?.text.trim().toLowerCase() ?? ''
    const value = row.querySelector('td')?.text.trim() ?? ''
    if (!value) continue

    for (const [key, type] of Object.entries(SPEC_LABEL_MAP)) {
      if (label.includes(key) && !seen.has(type)) {
        parts.push({ type, name: value })
        seen.add(type)
        break
      }
    }
  }

  return { prebuiltName, prebuiltPrice, prebuiltImageUrl, retailer: 'newegg', parts }
}
```

Create `lib/scraping/parsers/amazon.ts`:
```typescript
import { parse } from 'node-html-parser'
import type { ParsedListing } from './index'
import type { ExtractedPart } from '@/types'

const SPEC_LABEL_MAP: Record<string, ExtractedPart['type']> = {
  'cpu': 'cpu', 'processor': 'cpu',
  'gpu': 'gpu', 'graphics': 'gpu', 'graphics card': 'gpu',
  'ram': 'memory', 'memory': 'memory',
  'storage': 'storage', 'hard disk': 'storage', 'hard drive': 'storage',
  'motherboard': 'motherboard',
  'wattage': 'psu', 'power supply': 'psu',
  'standing screen display size': 'case',
  'cooling': 'cooling',
}

export function parseAmazon(html: string, url: string): ParsedListing {
  const root = parse(html)

  const prebuiltName = root.querySelector('#productTitle')?.text.trim() ??
    root.querySelector('h1')?.text.trim() ?? 'Unknown Product'

  const priceText = root.querySelector('.a-price .a-offscreen')?.text ??
    root.querySelector('#priceblock_ourprice')?.text ?? ''
  const prebuiltPrice = parseFloat(priceText.replace(/[^0-9.]/g, '')) || null

  const prebuiltImageUrl = root.querySelector('#landingImage')?.getAttribute('src') ?? null

  const parts: ExtractedPart[] = []
  const seen = new Set<ExtractedPart['type']>()

  // Amazon tech specs table
  const rows = root.querySelectorAll('#productDetails_techSpec_section_1 tr, .prodDetTable tr')
  for (const row of rows) {
    const label = row.querySelector('th')?.text.trim().toLowerCase() ?? ''
    const value = row.querySelector('td')?.text.trim() ?? ''
    for (const [key, type] of Object.entries(SPEC_LABEL_MAP)) {
      if (label.includes(key) && !seen.has(type) && value) {
        parts.push({ type, name: value })
        seen.add(type)
        break
      }
    }
  }

  // Fallback: bullet point feature list
  if (parts.length < 3) {
    const bullets = root.querySelectorAll('#feature-bullets li span.a-list-item')
    const cpuPatterns = [/intel core/i, /amd ryzen/i]
    const gpuPatterns = [/rtx \d+/i, /gtx \d+/i, /radeon rx/i]
    for (const bullet of bullets) {
      const text = bullet.text.trim()
      if (!seen.has('cpu') && cpuPatterns.some(p => p.test(text))) {
        parts.push({ type: 'cpu', name: text }); seen.add('cpu')
      }
      if (!seen.has('gpu') && gpuPatterns.some(p => p.test(text))) {
        parts.push({ type: 'gpu', name: text }); seen.add('gpu')
      }
    }
  }

  return { prebuiltName, prebuiltPrice, prebuiltImageUrl, retailer: 'amazon', parts }
}
```

Create `lib/scraping/parsers/walmart.ts`:
```typescript
import { parse } from 'node-html-parser'
import type { ParsedListing } from './index'
import type { ExtractedPart } from '@/types'

const SPEC_LABEL_MAP: Record<string, ExtractedPart['type']> = {
  'processor': 'cpu', 'cpu': 'cpu',
  'graphics': 'gpu', 'gpu': 'gpu', 'video card': 'gpu',
  'ram': 'memory', 'memory': 'memory',
  'storage': 'storage', 'hard drive': 'storage', 'ssd': 'storage',
  'motherboard': 'motherboard',
  'power': 'psu',
  'case': 'case',
  'cooling': 'cooling',
}

export function parseWalmart(html: string, url: string): ParsedListing {
  const root = parse(html)

  const prebuiltName = root.querySelector('[itemprop="name"]')?.text.trim() ??
    root.querySelector('h1')?.text.trim() ?? 'Unknown Product'

  const priceText = root.querySelector('[itemprop="price"]')?.getAttribute('content') ??
    root.querySelector('.price-characteristic')?.text ?? ''
  const prebuiltPrice = parseFloat(priceText.replace(/[^0-9.]/g, '')) || null

  const prebuiltImageUrl = root.querySelector('[data-testid="hero-image"] img')?.getAttribute('src') ?? null

  const parts: ExtractedPart[] = []
  const seen = new Set<ExtractedPart['type']>()

  const specRows = root.querySelectorAll('[data-testid="specification-row"]')
  for (const row of specRows) {
    const children = row.querySelectorAll('span, div')
    if (children.length < 2) continue
    const label = children[0].text.trim().toLowerCase()
    const value = children[1].text.trim()
    for (const [key, type] of Object.entries(SPEC_LABEL_MAP)) {
      if (label.includes(key) && !seen.has(type) && value) {
        parts.push({ type, name: value })
        seen.add(type)
        break
      }
    }
  }

  return { prebuiltName, prebuiltPrice, prebuiltImageUrl, retailer: 'walmart', parts }
}
```

- [ ] **Step 5: Run tests**

```bash
npm run test:run lib/scraping/parsers/parsers.test.ts
```

Expected: All parser tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/scraping/parsers/
git commit -m "feat: add retailer HTML parsers (Best Buy, Newegg, Amazon, Walmart)"
```

---

## Task 7: Retailer Price APIs

**Files:**
- Create: `lib/retailers/amazon.ts`
- Create: `lib/retailers/bestbuy.ts`
- Create: `lib/retailers/walmart.ts`
- Create: `lib/retailers/retailers.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/retailers/retailers.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchAmazon } from './amazon'
import { searchBestBuy } from './bestbuy'
import { searchWalmart } from './walmart'

vi.stubGlobal('fetch', vi.fn())

describe('searchBestBuy', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a RetailerListing with affiliate URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      products: [{
        name: 'Intel Core i7-13700KF',
        regularPrice: 289.99,
        sku: '1234567',
        url: '/site/intel-core-i7/1234567.p',
      }]
    }), { status: 200 }))

    const result = await searchBestBuy('Intel i7-13700KF')
    expect(result).not.toBeNull()
    expect(result!.price).toBe(289.99)
    expect(result!.retailer).toBe('bestbuy')
    expect(result!.affiliateUrl).toContain('bestbuy.com')
  })

  it('returns null when no products found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ products: [] }), { status: 200 }))
    const result = await searchBestBuy('nonexistent part xyz')
    expect(result).toBeNull()
  })
})

describe('searchWalmart', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a RetailerListing with affiliate URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      items: [{ name: 'Intel i7-13700KF', salePrice: 279.00, itemId: '999888777' }]
    }), { status: 200 }))

    const result = await searchWalmart('Intel i7-13700KF')
    expect(result).not.toBeNull()
    expect(result!.price).toBe(279.00)
    expect(result!.retailer).toBe('walmart')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run lib/retailers/retailers.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement Best Buy API**

Create `lib/retailers/bestbuy.ts`:
```typescript
import type { RetailerListing } from '@/types'

const BASE_URL = 'https://api.bestbuy.com/v1/products'
const AFFILIATE_BASE = 'https://bestbuy.7tiv.net/c/'

export async function searchBestBuy(query: string): Promise<RetailerListing | null> {
  const params = new URLSearchParams({
    apiKey: process.env.BESTBUY_API_KEY!,
    q: query,
    show: 'name,regularPrice,salePrice,sku,url',
    pageSize: '5',
    format: 'json',
  })

  const res = await fetch(`${BASE_URL}?${params}`)
  if (!res.ok) return null

  const data = await res.json()
  const product = data.products?.[0]
  if (!product) return null

  const price = product.salePrice ?? product.regularPrice
  const productUrl = `https://www.bestbuy.com${product.url}`
  const affiliateUrl = `${AFFILIATE_BASE}${process.env.BESTBUY_AFFILIATE_TAG}/${encodeURIComponent(productUrl)}`

  return {
    retailer: 'bestbuy',
    price,
    name: product.name,
    affiliateUrl,
  }
}
```

- [ ] **Step 4: Implement Walmart API**

Create `lib/retailers/walmart.ts`:
```typescript
import type { RetailerListing } from '@/types'

// Walmart uses OAuth2 — get token first, then search
async function getWalmartToken(): Promise<string> {
  const credentials = Buffer.from(
    `${process.env.WALMART_CLIENT_ID}:${process.env.WALMART_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch('https://marketplace.walmartapis.com/v3/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'WM_SVC.NAME': 'Walmart Marketplace',
      'WM_QOS.CORRELATION_ID': crypto.randomUUID(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  const data = await res.json()
  return data.access_token
}

export async function searchWalmart(query: string): Promise<RetailerListing | null> {
  const token = await getWalmartToken()

  const params = new URLSearchParams({ query, numItems: '5' })
  const res = await fetch(`https://developer.api.walmart.com/api-proxy/service/affil/product/v2/search?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'WM_SVC.NAME': 'PrebuiltCheck',
      'WM_QOS.CORRELATION_ID': crypto.randomUUID(),
    },
  })

  if (!res.ok) return null
  const data = await res.json()
  const item = data.items?.[0]
  if (!item) return null

  const affiliateUrl = `https://goto.walmart.com/c/${process.env.WALMART_AFFILIATE_IMPACT_ID}/...?u=${encodeURIComponent(item.productUrl)}`

  return {
    retailer: 'walmart',
    price: item.salePrice,
    name: item.name,
    affiliateUrl,
  }
}
```

- [ ] **Step 5: Implement Amazon PA API**

Create `lib/retailers/amazon.ts`:
```typescript
import type { RetailerListing } from '@/types'

// Amazon PA API requires request signing — use the official SDK
// npm install paapi5-nodejs-sdk is already installed in Task 1

export async function searchAmazon(query: string): Promise<RetailerListing | null> {
  // Dynamic import to avoid SSR issues with the SDK
  const { DefaultApi, SearchItemsRequest, PartnerType, Resources } = await import('paapi5-nodejs-sdk')

  const defaultClient = (await import('paapi5-nodejs-sdk')).ApiClient.instance
  defaultClient.accessKey = process.env.AMAZON_ACCESS_KEY!
  defaultClient.secretKey = process.env.AMAZON_SECRET_KEY!
  defaultClient.host = 'webservices.amazon.com'
  defaultClient.region = 'us-east-1'

  const api = new DefaultApi()

  const request = new SearchItemsRequest()
  request.PartnerTag = process.env.AMAZON_PARTNER_TAG!
  request.PartnerType = PartnerType.ASSOCIATES
  request.Keywords = query
  request.SearchIndex = 'Electronics'
  request.ItemCount = 5
  request.Resources = [
    Resources.ITEM_INFO_TITLE,
    Resources.OFFERS_LISTINGS_PRICE,
    Resources.ITEM_INFO_FEATURES,
  ]

  return new Promise((resolve) => {
    api.searchItems(request, (_error: unknown, data: any) => {
      if (!data?.SearchResult?.Items?.length) {
        resolve(null)
        return
      }

      const item = data.SearchResult.Items[0]
      const price = item.Offers?.Listings?.[0]?.Price?.Amount
      if (!price) { resolve(null); return }

      resolve({
        retailer: 'amazon',
        price: parseFloat(price),
        name: item.ItemInfo?.Title?.DisplayValue ?? query,
        affiliateUrl: item.DetailPageURL,
      })
    })
  })
}
```

- [ ] **Step 6: Run all retailer tests**

```bash
npm run test:run lib/retailers/retailers.test.ts
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/retailers/
git commit -m "feat: add Amazon, Best Buy, Walmart retailer API integrations"
```

---

## Task 8: Pricing Logic

**Files:**
- Create: `lib/retailers/pricing.ts`
- Create: `lib/retailers/pricing.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/retailers/pricing.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { selectLowestPrice, selectColorVariant } from './pricing'
import type { RetailerListing } from '@/types'

const listings: RetailerListing[] = [
  { retailer: 'amazon', price: 289.99, name: 'Intel Core i7-13700KF', affiliateUrl: 'https://amazon.com/dp/A?tag=x' },
  { retailer: 'bestbuy', price: 299.99, name: 'Intel Core i7-13700KF', affiliateUrl: 'https://bestbuy.com/p/1' },
  { retailer: 'walmart', price: 275.00, name: 'Intel Core i7-13700KF', affiliateUrl: 'https://walmart.com/ip/1' },
]

describe('selectLowestPrice', () => {
  it('returns the listing with the lowest price', () => {
    const result = selectLowestPrice(listings)
    expect(result.price).toBe(275.00)
    expect(result.retailer).toBe('walmart')
  })

  it('handles a single listing', () => {
    const result = selectLowestPrice([listings[0]])
    expect(result.retailer).toBe('amazon')
  })
})

describe('selectColorVariant', () => {
  const blackListings: RetailerListing[] = [
    { retailer: 'amazon', price: 29.99, name: 'Cooler Master Hyper 212 Black', affiliateUrl: 'https://amazon.com/dp/B?tag=x' },
  ]
  const whiteListings: RetailerListing[] = [
    { retailer: 'newegg', price: 34.99, name: 'Cooler Master Hyper 212 White', affiliateUrl: 'https://newegg.com/p/W' },
  ]

  it('returns lowest black variant', () => {
    const result = selectColorVariant(blackListings)
    expect(result?.name).toContain('Black')
    expect(result?.price).toBe(29.99)
  })

  it('returns lowest white variant', () => {
    const result = selectColorVariant(whiteListings)
    expect(result?.name).toContain('White')
  })

  it('returns null for empty array', () => {
    expect(selectColorVariant([])).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run lib/retailers/pricing.test.ts
```

Expected: FAIL — `selectLowestPrice` not found.

- [ ] **Step 3: Implement pricing logic**

Create `lib/retailers/pricing.ts`:
```typescript
import type { RetailerListing } from '@/types'

export function selectLowestPrice(listings: RetailerListing[]): RetailerListing {
  return listings.reduce((min, cur) => cur.price < min.price ? cur : min)
}

export function selectColorVariant(listings: RetailerListing[]): RetailerListing | null {
  if (!listings.length) return null
  return listings.reduce((min, cur) => cur.price < min.price ? cur : min)
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:run lib/retailers/pricing.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/retailers/pricing.ts lib/retailers/pricing.test.ts
git commit -m "feat: add lowest-price selection and color variant logic"
```

---

## Task 9: API Routes — Scrape + Compare

**Files:**
- Create: `app/api/scrape/route.ts`
- Create: `app/api/compare/route.ts`

- [ ] **Step 1: Implement /api/scrape**

Create `app/api/scrape/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { fetchPageHtml } from '@/lib/scraping/scrapingbee'
import { detectRetailer, parsePrebuiltPage } from '@/lib/scraping/parsers'
import { findCachedComparison } from '@/lib/scraping/dedup'
import { createServerClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { url } = await req.json()

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  // Dedup check
  const cachedSlug = await findCachedComparison(url)
  if (cachedSlug) {
    return NextResponse.json({ redirect: `/c/${cachedSlug}` })
  }

  let retailer: ReturnType<typeof detectRetailer>
  try {
    retailer = detectRetailer(url)
  } catch {
    return NextResponse.json({ error: 'Unsupported retailer URL' }, { status: 422 })
  }

  let html: string
  try {
    html = await fetchPageHtml(url)
  } catch (err: any) {
    return NextResponse.json({ error: `Scraping failed: ${err.message}` }, { status: 502 })
  }

  const parsed = parsePrebuiltPage(html, url, retailer)

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('pending_comparisons')
    .insert({
      prebuilt_url: url,
      prebuilt_name: parsed.prebuiltName,
      prebuilt_price: parsed.prebuiltPrice,
      prebuilt_image_url: parsed.prebuiltImageUrl,
      retailer,
      extracted_parts: parsed.parts,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to save pending comparison' }, { status: 500 })
  }

  return NextResponse.json({ pendingId: data.id })
}
```

- [ ] **Step 2: Implement /api/compare**

Create `app/api/compare/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { searchAmazon } from '@/lib/retailers/amazon'
import { searchBestBuy } from '@/lib/retailers/bestbuy'
import { searchWalmart } from '@/lib/retailers/walmart'
import { selectLowestPrice, selectColorVariant } from '@/lib/retailers/pricing'
import { generateSlug } from '@/lib/slug'
import type { ExtractedPart, PricedPart, RetailerListing } from '@/types'

async function lookupPart(part: ExtractedPart): Promise<PricedPart> {
  // Search all retailers in parallel
  const [amazonAny, bbAny, walmartAny] = await Promise.all([
    searchAmazon(part.name).catch(() => null),
    searchBestBuy(part.name).catch(() => null),
    searchWalmart(part.name).catch(() => null),
  ])

  const anyListings = [amazonAny, bbAny, walmartAny].filter(Boolean) as RetailerListing[]

  // Color variants — append color keyword to search
  const [amazonBlack, bbBlack, walmartBlack, amazonWhite, bbWhite, walmartWhite] = await Promise.all([
    searchAmazon(`${part.name} black`).catch(() => null),
    searchBestBuy(`${part.name} black`).catch(() => null),
    searchWalmart(`${part.name} black`).catch(() => null),
    searchAmazon(`${part.name} white`).catch(() => null),
    searchBestBuy(`${part.name} white`).catch(() => null),
    searchWalmart(`${part.name} white`).catch(() => null),
  ])

  const blackListings = [amazonBlack, bbBlack, walmartBlack].filter(Boolean) as RetailerListing[]
  const whiteListings = [amazonWhite, bbWhite, walmartWhite].filter(Boolean) as RetailerListing[]

  const lowest = anyListings.length ? selectLowestPrice(anyListings) : null
  const black = selectColorVariant(blackListings)
  const white = selectColorVariant(whiteListings)

  if (!lowest) {
    // Part not found — return placeholder so comparison still renders
    return {
      type: part.type,
      name: part.name,
      lowestPrice: 0,
      lowestRetailer: 'amazon',
      lowestAffiliateUrl: `https://www.amazon.com/s?k=${encodeURIComponent(part.name)}&tag=${process.env.AMAZON_ASSOCIATE_TAG}`,
      blackPrice: null, blackRetailer: null, blackAffiliateUrl: null,
      whitePrice: null, whiteRetailer: null, whiteAffiliateUrl: null,
    }
  }

  return {
    type: part.type,
    name: part.name,
    lowestPrice: lowest.price,
    lowestRetailer: lowest.retailer,
    lowestAffiliateUrl: lowest.affiliateUrl,
    blackPrice: black?.price ?? null,
    blackRetailer: black?.retailer ?? null,
    blackAffiliateUrl: black?.affiliateUrl ?? null,
    whitePrice: white?.price ?? null,
    whiteRetailer: white?.retailer ?? null,
    whiteAffiliateUrl: white?.affiliateUrl ?? null,
  }
}

export async function POST(req: NextRequest) {
  const { pendingId, confirmedParts } = await req.json()

  if (!pendingId || !Array.isArray(confirmedParts)) {
    return NextResponse.json({ error: 'pendingId and confirmedParts are required' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data: pending, error: pendingErr } = await supabase
    .from('pending_comparisons')
    .select('*')
    .eq('id', pendingId)
    .single()

  if (pendingErr || !pending) {
    return NextResponse.json({ error: 'Pending comparison not found' }, { status: 404 })
  }

  // Look up all parts in parallel
  const pricedParts = await Promise.all(
    (confirmedParts as ExtractedPart[]).map(lookupPart)
  )

  const slug = generateSlug()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: comparison, error: compErr } = await supabase
    .from('comparisons')
    .insert({
      slug,
      prebuilt_url: pending.prebuilt_url,
      prebuilt_name: pending.prebuilt_name,
      prebuilt_price: pending.prebuilt_price,
      prebuilt_image_url: pending.prebuilt_image_url,
      retailer: pending.retailer,
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (compErr) {
    return NextResponse.json({ error: 'Failed to save comparison' }, { status: 500 })
  }

  await supabase.from('parts').insert(
    pricedParts.map(p => ({
      comparison_id: comparison.id,
      type: p.type,
      name: p.name,
      lowest_price: p.lowestPrice,
      lowest_retailer: p.lowestRetailer,
      lowest_affiliate_url: p.lowestAffiliateUrl,
      black_price: p.blackPrice,
      black_retailer: p.blackRetailer,
      black_affiliate_url: p.blackAffiliateUrl,
      white_price: p.whitePrice,
      white_retailer: p.whiteRetailer,
      white_affiliate_url: p.whiteAffiliateUrl,
    }))
  )

  // Clean up pending comparison
  await supabase.from('pending_comparisons').delete().eq('id', pendingId)

  return NextResponse.json({ slug })
}
```

- [ ] **Step 3: Verify routes are registered**

```bash
npm run dev
```

Open http://localhost:3000/api/scrape in browser — should return 405 Method Not Allowed (GET not allowed, POST expected). Confirms route is registered.

- [ ] **Step 4: Commit**

```bash
git add app/api/
git commit -m "feat: add /api/scrape and /api/compare routes"
```

---

## Task 10: Homepage + URL Input Component

**Files:**
- Create: `components/UrlInput.tsx`
- Modify: `app/page.tsx`
- Create: `app/globals.css` (update with design tokens)

- [ ] **Step 1: Set up global styles**

Replace `app/globals.css` with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg: #0f0f13;
  --surface: #141420;
  --surface-hover: #1a1a2e;
  --border: #2d2d4a;
  --text: #f9fafb;
  --text-muted: #6b7280;
  --accent: #6366f1;
  --green: #4ade80;
  --red: #ef4444;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

- [ ] **Step 2: Write UrlInput component test**

Create `components/UrlInput.test.tsx`:
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import UrlInput from './UrlInput'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

global.fetch = vi.fn()

describe('UrlInput', () => {
  it('renders paste input and compare button', () => {
    render(<UrlInput />)
    expect(screen.getByPlaceholderText(/paste a.*url/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /compare/i })).toBeInTheDocument()
  })

  it('shows error for non-retailer URL', async () => {
    render(<UrlInput />)
    await userEvent.type(screen.getByRole('textbox'), 'https://google.com')
    fireEvent.click(screen.getByRole('button', { name: /compare/i }))
    await waitFor(() => expect(screen.getByText(/unsupported retailer/i)).toBeInTheDocument())
  })

  it('navigates to /confirm on successful scrape', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(
      JSON.stringify({ pendingId: 'pending-123' }), { status: 200 }
    ))
    render(<UrlInput />)
    await userEvent.type(screen.getByRole('textbox'), 'https://www.bestbuy.com/site/product/123')
    fireEvent.click(screen.getByRole('button', { name: /compare/i }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/confirm/pending-123'))
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm run test:run components/UrlInput.test.tsx
```

Expected: FAIL — `UrlInput` not found.

- [ ] **Step 4: Implement UrlInput**

Create `components/UrlInput.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const SUPPORTED_DOMAINS = ['bestbuy.com', 'newegg.com', 'amazon.com', 'walmart.com', 'bhphotovideo.com', 'microcenter.com']

export default function UrlInput() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSupported = SUPPORTED_DOMAINS.some(d => url.includes(d))

  async function handleCompare() {
    if (!url) return
    if (!isSupported) {
      setError('Unsupported retailer — try Best Buy, Newegg, Amazon, or Walmart')
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
          placeholder="Paste a Best Buy, Newegg, Amazon or Walmart URL..."
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
      <p className="mt-2.5 text-xs text-[#374151] text-center">
        Works with Best Buy · Newegg · Amazon · Walmart · B&H · Micro Center
      </p>
    </div>
  )
}
```

- [ ] **Step 5: Build homepage**

Replace `app/page.tsx`:
```typescript
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
        <p className="text-sm text-[#6b7280] mb-8">Paste any prebuilt PC link — we'll find every part at its lowest price.</p>
        <UrlInput />
      </section>

      {/* Featured Deals — placeholder until comparisons exist */}
      <section className="px-7 pb-12">
        <div className="flex items-baseline gap-2.5 mb-4">
          <h2 className="text-[15px] font-bold">Featured Deals</h2>
          <span className="text-xs text-[#4b5563]">Best savings this week</span>
          <span className="ml-auto text-xs text-[#6366f1] cursor-pointer">View all →</span>
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
```

- [ ] **Step 6: Run component tests**

```bash
npm run test:run components/UrlInput.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 7: Visually verify homepage**

```bash
npm run dev
```

Open http://localhost:3000 — hero, URL input, and placeholder cards should render.

- [ ] **Step 8: Commit**

```bash
git add app/page.tsx app/globals.css components/UrlInput.tsx components/UrlInput.test.tsx
git commit -m "feat: add homepage with URL input component"
```

---

## Task 11: Parts Confirmation Page

**Files:**
- Create: `components/PartsConfirmTable.tsx`
- Create: `app/confirm/[id]/page.tsx`

- [ ] **Step 1: Write PartsConfirmTable test**

Create `components/PartsConfirmTable.test.tsx`:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PartsConfirmTable from './PartsConfirmTable'
import type { ExtractedPart } from '@/types'

const mockParts: ExtractedPart[] = [
  { type: 'cpu', name: 'Intel Core i7-13700KF' },
  { type: 'gpu', name: 'NVIDIA GeForce RTX 4070' },
]

describe('PartsConfirmTable', () => {
  it('renders each part row', () => {
    render(<PartsConfirmTable parts={mockParts} pendingId="abc" onConfirm={vi.fn()} loading={false} />)
    expect(screen.getByDisplayValue('Intel Core i7-13700KF')).toBeInTheDocument()
    expect(screen.getByDisplayValue('NVIDIA GeForce RTX 4070')).toBeInTheDocument()
  })

  it('calls onConfirm with updated parts when submitted', () => {
    const onConfirm = vi.fn()
    render(<PartsConfirmTable parts={mockParts} pendingId="abc" onConfirm={onConfirm} loading={false} />)
    fireEvent.click(screen.getByRole('button', { name: /looks good/i }))
    expect(onConfirm).toHaveBeenCalledWith(mockParts)
  })

  it('allows editing a part name', () => {
    const onConfirm = vi.fn()
    render(<PartsConfirmTable parts={mockParts} pendingId="abc" onConfirm={onConfirm} loading={false} />)
    const cpuInput = screen.getByDisplayValue('Intel Core i7-13700KF')
    fireEvent.change(cpuInput, { target: { value: 'Intel Core i7-13700K' } })
    fireEvent.click(screen.getByRole('button', { name: /looks good/i }))
    expect(onConfirm).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'Intel Core i7-13700K' })])
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run components/PartsConfirmTable.test.tsx
```

Expected: FAIL — `PartsConfirmTable` not found.

- [ ] **Step 3: Implement PartsConfirmTable**

Create `components/PartsConfirmTable.tsx`:
```typescript
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

  return (
    <div className="w-full">
      <div className="grid grid-cols-[120px_1fr] gap-3 px-3 py-2 text-[10px] text-[#4b5563] uppercase tracking-[0.8px] mb-1">
        <span>Type</span><span>Component (edit if needed)</span>
      </div>
      <div className="flex flex-col gap-0.5">
        {editedParts.map((part, i) => (
          <div key={i} className="grid grid-cols-[120px_1fr] gap-3 bg-[#141420] hover:bg-[#1a1a2e] rounded-lg px-3 py-3 items-center transition-colors">
            <span className="text-[11px] text-[#6b7280] font-medium">{PART_LABELS[part.type]}</span>
            <input
              value={part.name}
              onChange={e => updateName(i, e.target.value)}
              className="bg-transparent text-[13px] text-[#e5e7eb] outline-none border-b border-transparent hover:border-[#2d2d4a] focus:border-[#6366f1] transition-colors w-full"
            />
          </div>
        ))}
      </div>
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
```

- [ ] **Step 4: Build confirmation page**

Create `app/confirm/[id]/page.tsx`:
```typescript
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'
import ConfirmClient from './ConfirmClient'

export default async function ConfirmPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const { data: pending } = await supabase
    .from('pending_comparisons')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!pending) notFound()

  return (
    <main className="min-h-screen bg-[#0f0f13] px-7 py-10 max-w-3xl mx-auto">
      <h1 className="text-[18px] font-bold text-[#f9fafb] mb-1">Confirm the parts list</h1>
      <p className="text-sm text-[#6b7280] mb-8">We extracted these specs from the listing. Edit anything that looks wrong.</p>
      <ConfirmClient pendingId={params.id} parts={pending.extracted_parts} />
    </main>
  )
}
```

Create `app/confirm/[id]/ConfirmClient.tsx`:
```typescript
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
```

- [ ] **Step 5: Run tests**

```bash
npm run test:run components/PartsConfirmTable.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/PartsConfirmTable.tsx components/PartsConfirmTable.test.tsx app/confirm/
git commit -m "feat: add parts confirmation page"
```

---

## Task 12: Comparison Page Components

**Files:**
- Create: `components/ComparisonHeader.tsx`
- Create: `components/ColorToggle.tsx`
- Create: `components/WindowsToggle.tsx`
- Create: `components/PartsTable.tsx`
- Create: `components/PartsTable.test.tsx`
- Create: `app/c/[slug]/page.tsx`

- [ ] **Step 1: Write PartsTable test**

Create `components/PartsTable.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PartsTable from './PartsTable'
import type { PricedPart } from '@/types'

const parts: PricedPart[] = [
  {
    type: 'cpu', name: 'Intel Core i7-13700KF',
    lowestPrice: 289, lowestRetailer: 'amazon', lowestAffiliateUrl: 'https://amazon.com/dp/A?tag=x',
    blackPrice: 295, blackRetailer: 'bestbuy', blackAffiliateUrl: 'https://bestbuy.com/p/1',
    whitePrice: null, whiteRetailer: null, whiteAffiliateUrl: null,
  },
]

describe('PartsTable', () => {
  it('renders part type and name', () => {
    render(<PartsTable parts={parts} colorFilter="lowest" />)
    expect(screen.getByText('CPU')).toBeInTheDocument()
    expect(screen.getByText('Intel Core i7-13700KF')).toBeInTheDocument()
  })

  it('shows lowest price in lowest mode', () => {
    render(<PartsTable parts={parts} colorFilter="lowest" />)
    expect(screen.getByText('$289.00 →')).toBeInTheDocument()
    expect(screen.getByText('Amazon')).toBeInTheDocument()
  })

  it('shows black price in black mode', () => {
    render(<PartsTable parts={parts} colorFilter="black" />)
    expect(screen.getByText('$295.00 →')).toBeInTheDocument()
  })

  it('falls back to lowest when white variant unavailable', () => {
    render(<PartsTable parts={parts} colorFilter="white" />)
    // No white variant — falls back to lowest
    expect(screen.getByText('$289.00 →')).toBeInTheDocument()
    expect(screen.getByText(/white only/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run components/PartsTable.test.tsx
```

Expected: FAIL — `PartsTable` not found.

- [ ] **Step 3: Implement components**

Create `components/PartsTable.tsx`:
```typescript
'use client'

import type { PricedPart, PartType, RetailerName } from '@/types'

const PART_LABELS: Record<PartType, string> = {
  cpu: 'CPU', gpu: 'GPU', motherboard: 'Motherboard', memory: 'Memory',
  storage: 'Storage', psu: 'Power Supply', case: 'Case', cooling: 'Cooling',
}

const RETAILER_COLORS: Record<RetailerName, string> = {
  amazon: '#ff9900', bestbuy: '#0046be', walmart: '#007dc6', newegg: '#e2231a',
}

const RETAILER_LABELS: Record<RetailerName, string> = {
  amazon: 'Amazon', bestbuy: 'Best Buy', walmart: 'Walmart', newegg: 'Newegg',
}

type ColorFilter = 'lowest' | 'black' | 'white'

interface Props {
  parts: PricedPart[]
  colorFilter: ColorFilter
}

function getDisplayData(part: PricedPart, filter: ColorFilter): {
  price: number; retailer: RetailerName; url: string; fallback: boolean
} {
  if (filter === 'black' && part.blackPrice && part.blackAffiliateUrl && part.blackRetailer) {
    return { price: part.blackPrice, retailer: part.blackRetailer as RetailerName, url: part.blackAffiliateUrl, fallback: false }
  }
  if (filter === 'white' && part.whitePrice && part.whiteAffiliateUrl && part.whiteRetailer) {
    return { price: part.whitePrice, retailer: part.whiteRetailer as RetailerName, url: part.whiteAffiliateUrl, fallback: false }
  }
  return { price: part.lowestPrice, retailer: part.lowestRetailer as RetailerName, url: part.lowestAffiliateUrl, fallback: filter !== 'lowest' }
}

export default function PartsTable({ parts, colorFilter }: Props) {
  const total = parts.reduce((sum, part) => {
    const { price } = getDisplayData(part, colorFilter)
    return sum + price
  }, 0)

  return (
    <div className="w-full">
      <div className="grid grid-cols-[120px_1fr_100px_120px] gap-3 px-3 py-2 text-[10px] text-[#4b5563] uppercase tracking-[0.8px] mb-1">
        <span>Type</span><span>Component</span><span>Retailer</span><span className="text-right">Best Price</span>
      </div>
      <div className="flex flex-col gap-0.5">
        {parts.map((part, i) => {
          const { price, retailer, url, fallback } = getDisplayData(part, colorFilter)
          return (
            <div key={i} className="grid grid-cols-[120px_1fr_100px_120px] gap-3 bg-[#141420] hover:bg-[#1a1a2e] rounded-lg px-3 py-3 items-center transition-colors">
              <span className="text-[11px] text-[#6b7280] font-medium">{PART_LABELS[part.type]}</span>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[#e5e7eb] font-medium">{part.name}</span>
                {fallback && (
                  <span className="text-[10px] bg-[#1e1e2e] text-[#6b7280] rounded px-1.5 py-0.5">
                    {colorFilter === 'black' ? 'White only' : 'Black only'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-sm inline-block" style={{ background: RETAILER_COLORS[retailer] }} />
                <span className="text-[11px] text-[#9ca3af]">{RETAILER_LABELS[retailer]}</span>
              </div>
              <div className="text-right">
                {price > 0 ? (
                  <a href={url} target="_blank" rel="noopener noreferrer sponsored"
                    className="text-[14px] font-bold text-[#818cf8] hover:text-[#6366f1] transition-colors">
                    ${price.toFixed(2)} →
                  </a>
                ) : (
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    className="text-[12px] text-[#6b7280] hover:text-[#9ca3af]">
                    Search →
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-[120px_1fr_100px_120px] gap-3 px-3 py-3.5 mt-2 border-t border-[#1e1e2e] items-center">
        <span />
        <span className="text-[13px] text-[#9ca3af]">Total (lowest prices)</span>
        <span />
        <span className="text-right text-[18px] font-bold text-[#4ade80]">${total.toFixed(2)}</span>
      </div>
      <p className="text-[10px] text-[#374151] mt-2 px-3">
        Links are affiliate links — we may earn a commission at no extra cost to you.{' '}
        <a href="/affiliate-disclosure" className="underline hover:text-[#6b7280]">Learn more</a>
      </p>
    </div>
  )
}
```

Create `components/ColorToggle.tsx`:
```typescript
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
```

Create `components/WindowsToggle.tsx`:
```typescript
'use client'

interface Props {
  enabled: boolean
  onChange: (enabled: boolean) => void
}

const WINDOWS_COST = 130

export { WINDOWS_COST }

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
```

Create `components/ComparisonHeader.tsx`:
```typescript
'use client'

interface Props {
  prebuiltName: string
  retailer: string
  prebuiltPrice: number
  buildTotal: number
  windowsEnabled: boolean
}

const RETAILER_LABELS: Record<string, string> = {
  bestbuy: 'Best Buy', newegg: 'Newegg', amazon: 'Amazon', walmart: 'Walmart',
}

export default function ComparisonHeader({ prebuiltName, retailer, prebuiltPrice, buildTotal, windowsEnabled }: Props) {
  const effectiveBuildTotal = buildTotal + (windowsEnabled ? 130 : 0)
  const savings = prebuiltPrice - effectiveBuildTotal
  const pct = Math.round(Math.abs(savings) / prebuiltPrice * 100)
  const cheaper = savings > 0

  return (
    <div className="mb-6">
      <p className="text-[11px] text-[#6b7280] uppercase tracking-[1px] mb-1.5">{RETAILER_LABELS[retailer] ?? retailer} · Prebuilt</p>
      <h1 className="text-[20px] font-bold text-[#f9fafb] tracking-tight mb-4">{prebuiltName}</h1>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="bg-[#1e1e2e] rounded-xl px-5 py-2.5">
          <p className="text-[10px] text-[#6b7280] uppercase tracking-[0.8px]">Prebuilt price</p>
          <p className="text-[22px] font-bold text-[#f9fafb] mt-0.5">${prebuiltPrice.toFixed(2)}</p>
        </div>
        <span className="text-[20px] text-[#374151]">vs</span>
        <div className={`rounded-xl px-5 py-2.5 border ${cheaper ? 'bg-[#052e16] border-[#166534]' : 'bg-[#2d0a0a] border-[#7f1d1d]'}`}>
          <p className={`text-[10px] uppercase tracking-[0.8px] ${cheaper ? 'text-[#4ade80]' : 'text-[#ef4444]'}`}>Build it yourself</p>
          <p className={`text-[22px] font-bold mt-0.5 ${cheaper ? 'text-[#4ade80]' : 'text-[#ef4444]'}`}>${effectiveBuildTotal.toFixed(2)}</p>
        </div>
        <div className={`rounded-xl px-4 py-2 font-bold text-[13px] ${cheaper ? 'bg-[#4ade80] text-[#052e16]' : 'bg-[#ef4444] text-white'}`}>
          {cheaper ? `Save $${savings.toFixed(0)} (${pct}%)` : `Prebuilt saves $${Math.abs(savings).toFixed(0)} (${pct}%)`}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run PartsTable tests**

```bash
npm run test:run components/PartsTable.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 5: Build comparison page**

Create `app/c/[slug]/page.tsx`:
```typescript
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'
import ComparisonClient from './ComparisonClient'
import type { PricedPart } from '@/types'

export default async function ComparisonPage({ params }: { params: { slug: string } }) {
  const supabase = createServerClient()

  const { data: comparison } = await supabase
    .from('comparisons')
    .select('*')
    .eq('slug', params.slug)
    .single()

  if (!comparison) notFound()

  const { data: partsRows } = await supabase
    .from('parts')
    .select('*')
    .eq('comparison_id', comparison.id)

  const parts: PricedPart[] = (partsRows ?? []).map(row => ({
    type: row.type,
    name: row.name,
    lowestPrice: row.lowest_price,
    lowestRetailer: row.lowest_retailer,
    lowestAffiliateUrl: row.lowest_affiliate_url,
    blackPrice: row.black_price,
    blackRetailer: row.black_retailer,
    blackAffiliateUrl: row.black_affiliate_url,
    whitePrice: row.white_price,
    whiteRetailer: row.white_retailer,
    whiteAffiliateUrl: row.white_affiliate_url,
  }))

  return (
    <main className="min-h-screen bg-[#0f0f13]">
      <nav className="flex items-center gap-3 px-6 py-4 border-b border-[#1e1e2e]">
        <a href="/" className="text-[15px] font-bold tracking-tight text-white">PrebuiltCheck</a>
        <span className="flex-1" />
        <span className="text-xs text-[#6b7280]">Sign in</span>
      </nav>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <ComparisonClient
          prebuiltName={comparison.prebuilt_name}
          retailer={comparison.retailer}
          prebuiltPrice={comparison.prebuilt_price}
          slug={comparison.slug}
          parts={parts}
        />
      </div>
    </main>
  )
}
```

Create `app/c/[slug]/ComparisonClient.tsx`:
```typescript
'use client'

import { useState } from 'react'
import ComparisonHeader from '@/components/ComparisonHeader'
import ColorToggle from '@/components/ColorToggle'
import WindowsToggle from '@/components/WindowsToggle'
import PartsTable from '@/components/PartsTable'
import type { PricedPart } from '@/types'

type ColorFilter = 'lowest' | 'black' | 'white'

interface Props {
  prebuiltName: string
  retailer: string
  prebuiltPrice: number
  slug: string
  parts: PricedPart[]
}

function getBuildTotal(parts: PricedPart[], filter: ColorFilter): number {
  return parts.reduce((sum, part) => {
    if (filter === 'black' && part.blackPrice) return sum + part.blackPrice
    if (filter === 'white' && part.whitePrice) return sum + part.whitePrice
    return sum + part.lowestPrice
  }, 0)
}

export default function ComparisonClient({ prebuiltName, retailer, prebuiltPrice, slug, parts }: Props) {
  const [colorFilter, setColorFilter] = useState<ColorFilter>('lowest')
  const [windowsEnabled, setWindowsEnabled] = useState(false)

  const buildTotal = getBuildTotal(parts, colorFilter)

  async function handleShare() {
    const url = `${window.location.origin}/c/${slug}`
    await navigator.clipboard.writeText(url)
    alert('Link copied to clipboard!')
  }

  return (
    <>
      <ComparisonHeader
        prebuiltName={prebuiltName}
        retailer={retailer}
        prebuiltPrice={prebuiltPrice}
        buildTotal={buildTotal}
        windowsEnabled={windowsEnabled}
      />
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <ColorToggle value={colorFilter} onChange={setColorFilter} />
        <div className="flex items-center gap-2">
          <WindowsToggle enabled={windowsEnabled} onChange={setWindowsEnabled} />
          <button onClick={handleShare}
            className="bg-[#1e1e2e] text-[#9ca3af] hover:text-white border border-[#2d2d4a] rounded-lg px-3.5 py-2 text-[12px] transition-colors">
            Share
          </button>
          <button className="bg-[#6366f1] text-white rounded-lg px-3.5 py-2 text-[12px] font-semibold">
            Save
          </button>
        </div>
      </div>
      <PartsTable parts={parts} colorFilter={colorFilter} />
    </>
  )
}
```

- [ ] **Step 6: Run all tests**

```bash
npm run test:run
```

Expected: All tests pass.

- [ ] **Step 7: Verify end-to-end in dev**

```bash
npm run dev
```

With real API keys in `.env.local`:
1. Go to http://localhost:3000
2. Paste a real Best Buy prebuilt URL
3. Confirm parts list loads at `/confirm/[id]`
4. Click "Looks good" and verify comparison page at `/c/[slug]`

- [ ] **Step 8: Commit**

```bash
git add components/ app/c/ app/confirm/
git commit -m "feat: add comparison page with color toggle, Windows toggle, and parts table"
```

---

## Task 13: Production Deploy to Vercel

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create Vercel project**

```bash
npx vercel
```

Follow prompts: link to existing Vercel account, create new project named `prebuiltcheck`.

- [ ] **Step 2: Add environment variables in Vercel dashboard**

Go to vercel.com → Project → Settings → Environment Variables. Add every variable from `.env.local.example` with real values.

- [ ] **Step 3: Add vercel.json for cron placeholder**

Create `vercel.json`:
```json
{
  "crons": []
}
```

(Cron jobs added in Plan 2.)

- [ ] **Step 4: Deploy**

```bash
npx vercel --prod
```

Expected: Deployment URL returned. Visit it and verify the homepage loads.

- [ ] **Step 5: Run full test suite one final time**

```bash
npm run test:run
```

Expected: All tests pass.

- [ ] **Step 6: Final commit**

```bash
git add vercel.json
git commit -m "feat: add Vercel config and deploy to production"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Auto-scrape prebuilt URL via ScrapingBee (Task 5, 6, 9)
- ✅ Parts extraction for Best Buy, Newegg, Amazon, Walmart (Task 6)
- ✅ User confirms parts (Task 11)
- ✅ Retailer API price lookup — Amazon, Best Buy, Walmart (Task 7)
- ✅ Lowest price selected per part (Task 8)
- ✅ Color variants — black/white search + fallback badge (Task 8, 12)
- ✅ Windows license toggle (Task 12)
- ✅ Comparison page with savings/premium badge (Task 12)
- ✅ Affiliate links on all price cells, FTC disclosure (Task 12)
- ✅ Shareable link with 30-day TTL (Task 9)
- ✅ URL deduplication (Task 5, 9)
- ✅ Homepage with URL input (Task 10)
- ✅ Vercel deploy (Task 13)
- ⏭️ Newegg CJ datafeed — deferred to Plan 2 (requires nightly cron import)
- ⏭️ OG share images — deferred to Plan 3
- ⏭️ Featured deals on homepage — deferred to Plan 3 (requires content)
- ⏭️ User accounts / saved builds — Plan 2
- ⏭️ Price drop alerts, click tracking, rate limiting — Plan 2
- ⏭️ Navigation, tier lists, FAQ, browse, sitemap — Plan 3
