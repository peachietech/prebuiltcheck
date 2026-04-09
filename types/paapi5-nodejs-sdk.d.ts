declare module 'paapi5-nodejs-sdk' {
  export class ApiClient {
    static instance: ApiClient
    accessKey: string
    secretKey: string
    host: string
    region: string
  }

  export class DefaultApi {
    searchItems(request: SearchItemsRequest, callback: (error: unknown, data: SearchItemsResponse) => void): void
  }

  export class SearchItemsRequest {
    PartnerTag: string
    PartnerType: string
    Keywords: string
    SearchIndex: string
    ItemCount: number
    Resources: string[]
  }

  export interface SearchItemsResponse {
    SearchResult?: {
      Items?: Array<{
        DetailPageURL: string
        ItemInfo?: { Title?: { DisplayValue?: string } }
        Offers?: { Listings?: Array<{ Price?: { Amount?: string } }> }
      }>
    }
  }

  export const PartnerType: { ASSOCIATES: string }
  export const Resources: Record<string, string>
}
