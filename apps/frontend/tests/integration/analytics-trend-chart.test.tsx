import { render, screen } from '@testing-library/react'
import { it, expect } from 'vitest'
import { TrendChart } from '@/components/analytics/TrendChart'

it('explains unavailable Resend data instead of rendering empty axes', () => {
  render(<TrendChart data={[{ name: 'W1', uniqueOpenCount: null, uniqueClickCount: null }]} />)
  expect(screen.getByRole('status')).toHaveTextContent('Resend counts need delivery confirmations')
})
it('distinguishes no newsletters from unavailable CMS counts', () => {
  const { rerender } = render(<TrendChart data={[]} />)
  expect(screen.getByRole('status')).toHaveTextContent('No newsletters are available')
  rerender(<TrendChart tracker="cms" data={[{ name: 'W1', uniqueOpenCount: null, uniqueClickCount: null }]} />)
  expect(screen.getByRole('status')).toHaveTextContent('CMS counts need successfully sent recipients')
})
it('keeps real zero counts chartable', () => {
  render(<TrendChart data={[{ name: 'W1', uniqueOpenCount: 0, uniqueClickCount: 0 }]} />)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
