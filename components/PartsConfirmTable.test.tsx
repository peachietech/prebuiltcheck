import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PartsConfirmTable from './PartsConfirmTable'
import type { ExtractedPart } from '@/types'

const mockParts: ExtractedPart[] = [
  { type: 'cpu', name: 'Intel Core i7-13700KF' },
  { type: 'gpu', name: 'NVIDIA GeForce RTX 4070' },
]

describe('PartsConfirmTable', () => {
  it('renders each part row', () => {
    render(<PartsConfirmTable parts={mockParts} pendingId="abc" onConfirm={vi.fn()} loading={false} />)
    expect(screen.getByDisplayValue('Intel Core i7-13700KF')).toBeInTheDocument()
    expect(screen.getByDisplayValue('NVIDIA GeForce RTX 4070')).toBeInTheDocument()
  })

  it('calls onConfirm with updated parts when submitted', () => {
    const onConfirm = vi.fn()
    render(<PartsConfirmTable parts={mockParts} pendingId="abc" onConfirm={onConfirm} loading={false} />)
    fireEvent.click(screen.getByRole('button', { name: /looks good/i }))
    expect(onConfirm).toHaveBeenCalledWith(mockParts)
  })

  it('allows editing a part name', () => {
    const onConfirm = vi.fn()
    render(<PartsConfirmTable parts={mockParts} pendingId="abc" onConfirm={onConfirm} loading={false} />)
    const cpuInput = screen.getByDisplayValue('Intel Core i7-13700KF')
    fireEvent.change(cpuInput, { target: { value: 'Intel Core i7-13700K' } })
    fireEvent.click(screen.getByRole('button', { name: /looks good/i }))
    expect(onConfirm).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'Intel Core i7-13700K' })])
    )
  })
})
