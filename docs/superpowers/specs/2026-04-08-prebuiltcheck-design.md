# PrebuiltCheck — Design Spec
**Date:** 2026-04-08

## Overview

PrebuiltCheck is a website where users paste a prebuilt PC product URL (from Best Buy, Newegg, Amazon, Walmart, B&H, or Micro Center). The site automatically scrapes the listing, extracts the component list, and shows a side-by-side comparison of the prebuilt price vs. the cost of sourcing each part individually at its lowest available price across four major retailers — all links affiliate-tagged for revenue.

---

## Architecture

### Stack
| Layer | Choice | Reason |
|---|---|---|
| Frontend + API | Next.js 14 (App Router) on Vercel | Free tier, auto-scales, no server to manage |
| Database + Auth | Supabase (PostgreSQL + built-in auth) | Free up to 500MB, handles auth + data in one service |
| Scraping | ScrapingBee | Bypasses bot detection; 1,000 free API calls to start, then $29/mo |
| Price refresh | Vercel Cron Jobs | Free; runs nightly to update cached part prices |
| Retailer APIs | Amazon PA API, Best Buy Products API, Walmart Open API, Newegg CJ Affiliate datafeed | One integration per retailer affiliate account |

### Estimated monthly cost (early stage)
- **$0** — Vercel free tier, Supabase free tier, Vercel Cron free
- **$0–$29** — ScrapingBee (free trial, then $29/mo once usage warrants it)

---

## Core User Flow

1. **User pastes a prebuilt PC URL** from any supported retailer
2. **Backend sends URL to ScrapingBee**, which fetches the page HTML bypassing bot detection
3. **Parts are extracted** from the spec section: CPU, GPU, Motherboard, Memory, Storage, PSU, Case, Cooling
4. **User confirms the parts list** in an editable table before the comparison is built
5. **Retailer APIs are queried** for each part — Amazon PA API, Best Buy API, Walmart API, Newegg CJ datafeed
6. **Lowest price across all retailers** is selected per part; affiliate link points to that retailer's listing
7. **Comparison page renders** with prebuilt price vs. build total, savings badge, and per-part affiliate links
8. **User can share or save** — shareable link (30-day expiry, no account needed) or saved to account

---

## Navigation

**Primary nav:** Logo · Browse Deals · Tier Lists ▾ · FAQ · Saved builds · Sign in

**Tier Lists dropdown (on hover):**
- By Budget: Under $800 · $1,000 · $1,500 · $2,000+
- By GPU: RTX 4060 · 4070 · 4080 · RX 7800 XT
- By Brand: iBUYPOWER · CyberPowerPC · Skytech
- Best Value Overall (highest savings % right now)

---

## Pages

### Homepage (`/`)
- **Hero:** Headline, subheadline, URL paste input + Compare button
  - Supported retailers listed below input (Best Buy · Newegg · Amazon · Walmart · B&H · Micro Center)
- **Featured Deals section:** Grid of prebuilt cards
  - Each card: product photo (scraped from listing), name, short spec summary, prebuilt price vs. build price, savings badge (green) or premium badge (red)
  - Card types: Sponsored (paid placement), Best Deal (auto, highest savings %), Popular (high views)
  - "View all →" link to `/browse`

### Comparison Page (`/c/[slug]`)
- **Header:** Prebuilt name, retailer source, prebuilt price, build-it price, savings/premium amount + percentage, Share button, Save button
- **Color filter toggle:** `Lowest | ⚫ Black | ⚪ White`
  - **Lowest** (default): absolute cheapest part regardless of color
  - **Black**: cheapest black-colorway variant per part; falls back to any color if no variant found
  - **White**: cheapest white-colorway variant per part; falls back to any color if no variant found
  - Total in footer updates to reflect filtered selection
- **Windows license toggle:** Optional "+$130 Windows 11 Home" line item; off by default, toggled on by user; updates build total and savings figure
- **Parts list:** One row per component
  - Columns: Type · Component name · Retailer (color dot + name) · Best Price (affiliate link `→`)
  - Retailer color coding: Amazon (orange) · Best Buy (blue) · Newegg (red) · Walmart (teal)
- **Footer row:** Total (lowest prices across all parts)
- **FTC disclosure:** Small "Links are affiliate links — we may earn a commission" notice below the parts list
- **OG share image:** Auto-generated on page creation; shows PC name, prebuilt price, build price, and savings amount — used when the link is shared on Reddit, Twitter, YouTube descriptions, etc.

### Parts Confirmation Page (`/confirm/[id]`)
- Shown after scraping, before the comparison is built
- Editable table of extracted parts — user can correct misread specs
- "Looks good, build comparison" CTA

### Browse Page (`/browse`)
- All analyzed prebuilts in a filterable grid
- Filters: Budget range, GPU model, Brand, Retailer, Sort by (savings %, price, newest)

### Tier List Pages (`/tier-lists`, `/tier-lists/[slug]`)
- Index page lists all published tier lists
- Individual pages: e.g. `/tier-lists/best-value-rtx-4070-prebuilts`
- Written in MDX; statically rendered for SEO
- Each tier list embeds live comparison cards (pulls from DB) so prices stay current
- Examples: "Best Value Prebuilts Under $1,000", "Best RTX 4080 Prebuilts", "iBUYPOWER vs CyberPowerPC"

### Articles (`/articles`, `/articles/[slug]`) — Hidden for now, infrastructure built but not linked in nav
- Index page lists all published articles
- Individual pages: e.g. `/articles/is-it-cheaper-to-build-your-own-pc`
- Written in MDX; statically rendered for SEO
- Affiliate links naturally embedded in article content
- Examples: "How to Read a Prebuilt Spec Sheet", "PC Building Cost Breakdown 2025", "Best Time of Year to Buy a Prebuilt"

### FAQ (`/faq`)
- Common questions: "Is it always cheaper to build?", "What does this site do?", "How are prices updated?", "What retailers do you support?"
- Structured data markup (FAQ schema) for Google rich results

### Account Pages (`/login`, `/dashboard`)
- Sign up / Sign in (Supabase Auth — email or Google OAuth)
- Saved builds dashboard: list of saved comparisons with name, date, prebuilt, savings amount, and price-change indicator since last visit

### Legal Pages
- `/terms` — Terms of Service
- `/privacy` — Privacy Policy
- `/affiliate-disclosure` — FTC-compliant affiliate disclosure page (linked from footer and comparison pages)

---

## Data Model

### `comparisons`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| slug | text | Short random ID used in share URL |
| user_id | uuid | Nullable (anonymous shares) |
| prebuilt_url | text | Original URL pasted by user |
| prebuilt_name | text | Scraped product name |
| prebuilt_price | numeric | Scraped retail price |
| prebuilt_image_url | text | Scraped product image |
| retailer | text | best_buy / newegg / amazon / walmart / bh / microcenter |
| created_at | timestamptz | |
| expires_at | timestamptz | 30 days from created_at for anonymous; null for saved |

### `parts`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| comparison_id | uuid | FK → comparisons |
| type | text | cpu / gpu / motherboard / memory / storage / psu / case / cooling |
| name | text | Full part name as extracted/confirmed |
| lowest_price | numeric | Cheapest price across all retailers |
| lowest_retailer | text | Retailer with lowest price |
| lowest_affiliate_url | text | Affiliate-tagged link for lowest price |
| black_price | numeric | Cheapest black variant price (nullable) |
| black_retailer | text | |
| black_affiliate_url | text | |
| white_price | numeric | Cheapest white variant price (nullable) |
| white_retailer | text | |
| white_affiliate_url | text | |
| last_price_updated | timestamptz | Set by nightly cron |

---

## Retailer API Integrations

### Amazon Product Advertising API (PA API 5.0)
- Search by keyword (part name) → get ASIN, price, and generate affiliate link with Associate tag
- Affiliate link format: `https://www.amazon.com/dp/{ASIN}?tag={ASSOCIATE_TAG}`
- Color variants: search `{part name} black` / `{part name} white` separately

### Best Buy Products API
- Search endpoint: `https://api.bestbuy.com/v1/products?apiKey=...&q={part name}`
- Returns price, SKU, product name; affiliate link via Impact Radius tag appended to `bestbuy.com/site/...`

### Walmart Open API
- Product search via `https://developer.walmart.com` — returns item ID, price
- Affiliate link via Impact Radius

### Newegg CJ Affiliate Datafeed
- Daily CSV/XML product feed from Commission Junction
- Imported into Supabase nightly; searched locally (no real-time API)
- Affiliate links embedded in datafeed

---

## Price Refresh (Nightly Cron)

- Vercel Cron Job runs at 2:00 AM UTC daily
- Iterates over all `parts` rows where `last_price_updated` is older than 20 hours
- For each part, queries all four retailer APIs/feeds for lowest price + color variants
- Updates `parts` table with new prices and affiliate URLs

---

## Monetization

### Affiliate revenue
- Every price link in the parts list is affiliate-tagged
- Revenue generated when a user clicks through and purchases
- Retailers: Amazon (up to 10%), Best Buy (~1–4%), Newegg (~1–2%), Walmart (~1–4%)

### Sponsored placements
- Homepage "Featured Deals" first slot is reservable as a sponsored card
- Sold directly to PC builders / retailers; flat monthly fee
- Identified with a "Sponsored" label on the card

---

## Sharing & Accounts

### Anonymous share links
- Generated immediately after comparison is built
- URL: `/c/{slug}` — 8-character random slug
- Stored in `comparisons` table with `expires_at = now() + 30 days`
- No account required

### User accounts (Supabase Auth)
- Email/password or Google OAuth
- Logged-in users can save comparisons (no expiry) and view them in a dashboard
- "Save" button on comparison page — if not signed in, prompts sign-in then saves

---

## Price Drop Alerts

- On the comparison page, logged-in users can set a price alert: "Notify me when build price drops below $X"
- Stored in a `price_alerts` table (user_id, comparison_id, threshold)
- Nightly cron checks alerts after refreshing prices; sends email via Resend (free tier: 3,000 emails/mo) when threshold is crossed
- Alert email includes updated build total + affiliate links to trigger click-through

### `price_alerts` table
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | FK → auth.users |
| comparison_id | uuid | FK → comparisons |
| threshold | numeric | Alert when build total drops below this |
| triggered_at | timestamptz | Nullable; set when alert fires |

---

## Performance & Abuse Prevention

- **Scrape deduplication:** If the same prebuilt URL is submitted within 24 hours, return the cached comparison instead of calling ScrapingBee again
- **Rate limiting:** Max 5 scrape requests per IP per hour via Vercel middleware; returns 429 with a friendly message
- **Click tracking:** Log affiliate link clicks (part type, retailer, comparison_id) to a `click_events` table for conversion analysis

### `click_events` table
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| comparison_id | uuid | FK → comparisons |
| part_id | uuid | FK → parts |
| retailer | text | |
| clicked_at | timestamptz | |

---

## SEO Strategy

- **Static comparison pages** for popular prebuilts are pre-rendered at build time (ISR — Incremental Static Regeneration) so they're indexable by Google immediately
- **Tier list pages** (`/tier-lists/[slug]`) are MDX files rendered statically; Google indexes them as editorial content
- **FAQ page** uses JSON-LD FAQ schema markup for Google rich results
- **OG images** auto-generated per comparison using `@vercel/og` (free, edge-rendered); shows PC name + savings amount for viral sharing on Reddit/Twitter/YouTube
- **Sitemap** auto-generated at `/sitemap.xml` covering all comparison slugs, tier lists, and FAQ

---

## Mobile Layout

- Homepage hero and URL input stack vertically; full width
- Featured deal cards scroll horizontally on mobile (single row snap scroll)
- Comparison page parts list collapses to 2 columns on mobile: Component name + Price (retailer shown as color dot only)
- Color filter toggle remains visible, pinned below the header summary on scroll

---

## Key Constraints & Edge Cases

- **Part not found:** If a part yields no retailer results, the row shows "Not found" with a manual search link; it does not block the comparison
- **Color variant unavailable:** If Black or White mode is active and no color variant exists for a part, that row falls back to the lowest-price listing and shows a small `"Black only"` or `"White only"` badge so the user knows the filter couldn't be applied to that component
- **Prebuilt price hidden behind login:** Some retailer pages gate pricing; ScrapingBee handles JS rendering but if price is still missing, user is prompted to enter it manually
- **Scraping failures:** If ScrapingBee fails (timeout, blocked), user sees an error with a retry option; no silent failures
- **Comparison total accuracy:** The "build it" total reflects the sum of lowest prices at time of last refresh; a disclaimer notes prices may have changed
