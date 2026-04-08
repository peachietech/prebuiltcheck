import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import UrlInput from './UrlInput'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

global.fetch = vi.fn()

describe('UrlInput', () => {
  it('renders paste input and compare button', () => {
    render(<UrlInput />)
    expect(screen.getByPlaceholderText(/paste a.*url/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /compare/i })).toBeInTheDocument()
  })

  it('shows error for non-retailer URL', async () => {
    render(<UrlInput />)
    await userEvent.type(screen.getByRole('textbox'), 'https://google.com')
    fireEvent.click(screen.getByRole('button', { name: /compare/i }))
    await waitFor(() => expect(screen.getByText(/unsupported retailer/i)).toBeInTheDocument())
  })

  it('navigates to /confirm on successful scrape', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(
      JSON.stringify({ pendingId: 'pending-123' }), { status: 200 }
    ))
    render(<UrlInput />)
    await userEvent.type(screen.getByRole('textbox'), 'https://www.bestbuy.com/site/product/123')
    fireEvent.click(screen.getByRole('button', { name: /compare/i }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/confirm/pending-123'))
  })
})
