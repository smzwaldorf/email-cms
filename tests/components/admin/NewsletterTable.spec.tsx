import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NewsletterTable from '@/components/admin/NewsletterTable'
import { BrowserRouter } from 'react-router-dom'

// Mock data
const mockNewsletters = [
  {
    id: '1',
    weekNumber: '2023-W01',
    releaseDate: '2023-01-01',
    status: 'published',
    articleCount: 5,
    createdAt: '2023-01-01',
    updatedAt: '2023-01-01',
    isPublished: true,
  },
  {
    id: '2',
    weekNumber: '2023-W02',
    releaseDate: '2023-01-08',
    status: 'draft',
    articleCount: 3,
    createdAt: '2023-01-08',
    updatedAt: '2023-01-08',
    isPublished: false,
  },
  {
    id: '3',
    weekNumber: '2023-W03',
    releaseDate: '2023-01-15',
    status: 'archived',
    articleCount: 4,
    createdAt: '2023-01-15',
    updatedAt: '2023-01-15',
    isPublished: true,
  },
] as any[]

describe('NewsletterTable', () => {
  it('renders all newsletters initially', () => {
    render(
      <BrowserRouter>
        <NewsletterTable newsletters={mockNewsletters} />
      </BrowserRouter>
    )
    expect(screen.getByText('2023-W01')).toBeInTheDocument()
    expect(screen.getByText('2023-W02')).toBeInTheDocument()
    expect(screen.getByText('2023-W03')).toBeInTheDocument()
    expect(screen.getByText('Is Published')).toBeInTheDocument()
  })

  it('filters newsletters by status using dropdown', async () => {
    render(
      <BrowserRouter>
        <NewsletterTable newsletters={mockNewsletters} />
      </BrowserRouter>
    )

    // Find the select element
    const select = screen.getByLabelText('按狀態篩選:')
    
    // Select 'draft'
    fireEvent.change(select, { target: { value: 'draft' } })
    
    expect(screen.queryByText('2023-W01')).not.toBeInTheDocument()
    expect(screen.getByText('2023-W02')).toBeInTheDocument()
    expect(screen.queryByText('2023-W03')).not.toBeInTheDocument()

    // Select 'published'
    fireEvent.change(select, { target: { value: 'published' } })
    
    expect(screen.getByText('2023-W01')).toBeInTheDocument()
    expect(screen.queryByText('2023-W02')).not.toBeInTheDocument()
    expect(screen.queryByText('2023-W03')).not.toBeInTheDocument()

    // Select 'all'
    fireEvent.change(select, { target: { value: 'all' } })
    
    expect(screen.getByText('2023-W01')).toBeInTheDocument()
    expect(screen.getByText('2023-W02')).toBeInTheDocument()
    expect(screen.getByText('2023-W03')).toBeInTheDocument()
  })
})
