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

describe('parsePrebuiltPage — Newegg', () => {
  const html = `
    <html><body>
      <h1 class="product-title">iBUYPOWER Gaming PC</h1>
      <div class="price-current">$1,199<span>.</span><sup>99</sup></div>
      <table class="product-specs">
        <tr><th>Processor</th><td>Intel Core i5-13600KF</td></tr>
        <tr><th>Graphics</th><td>NVIDIA GeForce RTX 4060</td></tr>
        <tr><th>Memory</th><td>16GB DDR5</td></tr>
      </table>
    </body></html>
  `
  it('extracts prebuilt name', () => {
    const result = parsePrebuiltPage(html, 'https://www.newegg.com/product/N82E123', 'newegg')
    expect(result.prebuiltName).toBe('iBUYPOWER Gaming PC')
  })
  it('extracts CPU part', () => {
    const result = parsePrebuiltPage(html, 'https://www.newegg.com/product/N82E123', 'newegg')
    const cpu = result.parts.find(p => p.type === 'cpu')
    expect(cpu?.name).toContain('i5-13600KF')
  })
})

describe('parsePrebuiltPage — Amazon', () => {
  const html = `
    <html><body>
      <span id="productTitle">CyberPowerPC Gamer Xtreme VR Gaming PC</span>
      <span class="a-price"><span class="a-offscreen">$1,099.99</span></span>
      <table id="productDetails_techSpec_section_1">
        <tr><th>Processor</th><td>Intel Core i7-13700F</td></tr>
        <tr><th>RAM</th><td>16GB DDR5</td></tr>
        <tr><th>Graphics</th><td>NVIDIA GeForce RTX 4070</td></tr>
      </table>
    </body></html>
  `
  it('extracts prebuilt name', () => {
    const result = parsePrebuiltPage(html, 'https://www.amazon.com/dp/B09XYZ', 'amazon')
    expect(result.prebuiltName).toContain('CyberPowerPC')
  })
  it('extracts CPU part', () => {
    const result = parsePrebuiltPage(html, 'https://www.amazon.com/dp/B09XYZ', 'amazon')
    const cpu = result.parts.find(p => p.type === 'cpu')
    expect(cpu?.name).toContain('i7-13700F')
  })
})

describe('parsePrebuiltPage — Walmart', () => {
  const html = `
    <html><body>
      <h1 itemprop="name">Skytech Shiva Gaming PC Desktop</h1>
      <span itemprop="price" content="899.00"></span>
      <div data-testid="specification-row"><span>Processor</span><span>AMD Ryzen 5 5600X</span></div>
      <div data-testid="specification-row"><span>Graphics</span><span>AMD Radeon RX 6700 XT</span></div>
    </body></html>
  `
  it('extracts prebuilt name', () => {
    const result = parsePrebuiltPage(html, 'https://www.walmart.com/ip/product/123', 'walmart')
    expect(result.prebuiltName).toContain('Skytech')
  })
  it('extracts CPU part', () => {
    const result = parsePrebuiltPage(html, 'https://www.walmart.com/ip/product/123', 'walmart')
    const cpu = result.parts.find(p => p.type === 'cpu')
    expect(cpu?.name).toContain('Ryzen 5 5600X')
  })
})
