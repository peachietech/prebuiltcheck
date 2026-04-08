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
