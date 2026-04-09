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
