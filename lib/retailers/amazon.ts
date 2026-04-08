import type { RetailerListing } from '@/types'

export async function searchAmazon(query: string): Promise<RetailerListing | null> {
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
