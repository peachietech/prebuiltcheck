import 'server-only'
import type { RetailerListing } from '@/types'

/**
 * Search Amazon via the Product Advertising API 5.0.
 *
 * Requires REAL PA API credentials (not OAuth / Login-with-Amazon):
 *   AMAZON_ACCESS_KEY  — 20-char uppercase key from associates.amazon.com → PA API
 *   AMAZON_SECRET_KEY  — 40-char base64 secret from the same page
 *   AMAZON_PARTNER_TAG — your Associates store tag (e.g. "yourstore-20")
 *
 * Returns null (gracefully) if credentials are missing or invalid.
 */
export async function searchAmazon(query: string): Promise<RetailerListing | null> {
  const accessKey = process.env.AMAZON_ACCESS_KEY
  const secretKey = process.env.AMAZON_SECRET_KEY
  const partnerTag = process.env.AMAZON_PARTNER_TAG

  if (!accessKey || !secretKey || !partnerTag) return null

  // Detect the wrong credential type (OAuth client IDs start with "amzn1.")
  // PA API keys are 20-char uppercase AWS-style strings
  if (accessKey.startsWith('amzn1.') || accessKey.length < 16) {
    // Wrong credential type — skip silently to avoid wasting time on 401s
    return null
  }

  try {
    const { DefaultApi, SearchItemsRequest, PartnerType, SearchItemsResource } =
      await import('paapi5-nodejs-sdk')
    const { ApiClient } = await import('paapi5-nodejs-sdk')

    const defaultClient = ApiClient.instance
    defaultClient.accessKey = accessKey
    defaultClient.secretKey = secretKey
    defaultClient.host = 'webservices.amazon.com'
    defaultClient.region = 'us-east-1'

    const api = new DefaultApi()
    const request = new SearchItemsRequest()
    request.PartnerTag = partnerTag
    request.PartnerType = PartnerType.ASSOCIATES
    request.Keywords = query
    request.SearchIndex = 'Electronics'
    request.ItemCount = 5
    request.Resources = [
      SearchItemsResource['ItemInfo.Title'],
      SearchItemsResource['Offers.Listings.Price'],
      SearchItemsResource['Images.Primary.Medium'],
    ]

    return new Promise((resolve) => {
      api.searchItems(request, (_error: unknown, data: any) => {
        if (!data?.SearchResult?.Items?.length) {
          resolve(null)
          return
        }

        // Pick the first item that has a price
        for (const item of data.SearchResult.Items) {
          const price = item.Offers?.Listings?.[0]?.Price?.Amount
          if (!price) continue
          resolve({
            retailer: 'amazon',
            price: parseFloat(price),
            name: item.ItemInfo?.Title?.DisplayValue ?? query,
            affiliateUrl: item.DetailPageURL,
          })
          return
        }
        resolve(null)
      })
    })
  } catch {
    return null
  }
}
