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
