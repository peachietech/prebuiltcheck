import 'server-only'

/**
 * Injects the site's affiliate tracking tag into a prebuilt product URL
 * so we earn commission if the user clicks through to buy the prebuilt.
 */
export function injectAffiliateTag(url: string, retailer: string): string {
  try {
    if (retailer === 'bestbuy') {
      const tag = process.env.BESTBUY_AFFILIATE_TAG
      if (tag) return `https://bestbuy.7tiv.net/c/${tag}?u=${encodeURIComponent(url)}`
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
      // Newegg affiliate via Rakuten Advertising (LinkSynergy).
      // NEWEGG_RAKUTEN_ID  = your Rakuten publisher id (the `id=` param in deep links)
      // NEWEGG_RAKUTEN_MID = Newegg's merchant id on Rakuten (defaults to 45924)
      const id = process.env.NEWEGG_RAKUTEN_ID
      if (id) {
        const mid = process.env.NEWEGG_RAKUTEN_MID ?? '45924'
        return `https://click.linksynergy.com/deeplink?id=${encodeURIComponent(id)}&mid=${mid}&murl=${encodeURIComponent(url)}`
      }
      return url
    }

    if (retailer === 'ibuypower') {
      // iBUYPOWER affiliate via Impact Radius.
      // IBUYPOWER_AFFILIATE_ID = your Impact publisher id (e.g. 5433751)
      // Deep-link format: https://ibuypower.sjv.io/c/{PUBLISHER_ID}/{encoded_url}
      const id = process.env.IBUYPOWER_AFFILIATE_ID
      if (id) {
        return `https://ibuypower.sjv.io/c/${id}/${encodeURIComponent(url)}`
      }
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
