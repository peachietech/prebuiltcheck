import 'server-only'

/**
 * Injects the site's affiliate tracking tag into a prebuilt product URL
 * so we earn commission if the user clicks through to buy the prebuilt.
 */
export function injectAffiliateTag(url: string, retailer: string): string {
  try {
    if (retailer === 'bestbuy') {
      const tag = process.env.BESTBUY_AFFILIATE_TAG
      if (tag) return `https://bestbuy.7tiv.net/c/${tag}/${encodeURIComponent(url)}`
    }

    if (retailer === 'amazon') {
      const tag = process.env.AMAZON_PARTNER_TAG
      if (tag) {
        const u = new URL(url)
        u.searchParams.set('tag', tag)
        return u.toString()
      }
    }

    if (retailer === 'newegg') {
      // Newegg uses Commission Junction — no tag injection without CJ link,
      // just return the direct URL for now
      return url
    }

    // All other retailers: return as-is
    return url
  } catch {
    return url
  }
}

/** Human-readable name for a retailer slug */
export const RETAILER_DISPLAY: Record<string, string> = {
  bestbuy: 'Best Buy',
  amazon: 'Amazon',
  newegg: 'Newegg',
  walmart: 'Walmart',
  ibuypower: 'iBUYPOWER',
  cyberpowerpc: 'CyberPowerPC',
  costco: 'Costco',
  nzxt: 'NZXT',
  hp: 'HP',
}
